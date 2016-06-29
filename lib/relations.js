const createEmptyObject = function () {
  return {};
};

function relation (name, asCollection = false, fn = createEmptyObject) {
  return function (model, ...args) {
    return Object.assign({}, fn(...args), {relation: name, model, asCollection});
  }
}

exports.definitions = {
  belongsTo: relation('belongsTo', false, function (foreignKey) {
    if (!foreignKey) {
      throw new Error('when using the relation "belongsTo", you must specify a foreignKey');
    }
    return {
      foreignKey
    };
  }),
  hasOne: relation('hasOne'),
  hasMany: relation('hasMany', true),
  belongsToMany: relation('belongsToMany', true, function (through, referenceKey) {
    if (!through) {
      throw new Error('when using the relation "belongsToMany", you must specify a through model');
    }
    return {through, referenceKey};
  })
};

const selectFieldsBehaviour = {
  selectFields(root = ''){
    const def = this.definition;
    const rootNamespace = root ? root + '.' : '';
    const output = def.attributes.map(attr=> {
      const value = root ? [root, `"${def.association}.${attr}"`] : [def.association, attr];
      const as = `"${rootNamespace}${def.association}.${attr}"`;
      return {
        value: value.join('.'),
        as
      }
    });
    const nested = this.nested || [];
    const nestedSelect = nested.map(n=>n.selectFields(def.association));
    return output.concat(...nestedSelect);
  }
};

function getReverseAssociation (sourceModel, association, sh) {
  const targetModel = sh.model(association.model);
  const targetRelations = targetModel.definition.relations;
  const reverseRelationName = Object.keys(targetRelations).filter(r=>targetRelations[r].model === sourceModel.name)[0];
  return targetRelations[reverseRelationName];
}

function eventuallyAddWhere (builder, where) {
  if (where) {
    builder.and(where)
  }
  return builder.noop();
}

function getFromClause (targetModel, nested) {
  return nested && nested.length ?
    targetModel
      .select()
      .include(...nested.map(n=>n.definition)) :
    targetModel.table;
}

const manyToMany = Object.assign({}, selectFieldsBehaviour, {
  join(builder, where){
    const definition = this.definition;
    const sourceModelDef = this.model.definition;
    const targetModel = this.sh.model(definition.model);
    const pivotModel = this.sh.model(this.definition.through);
    const sourceKeyOnPivot = sourceModelDef.relations[definition.association].referenceKey;
    const targetKeyOnPivot = getReverseAssociation(this.model, definition, this.sh).referenceKey;

    const pivotSelect = [sourceKeyOnPivot, targetKeyOnPivot].map(key=> {
      return {
        value: [pivotModel.table, key].join('.'),
        as: `"${definition.through}.${key}"`
      };
    });
    const allSelect = pivotSelect.concat(targetModel.table + '.*');
    const pivotLeftOperand = [pivotModel.table, targetKeyOnPivot].join('.');
    const pivotRightOperand = `"${targetModel.table}"."${targetModel.primaryKey}"`;

    let pivot = pivotModel
      .select(...allSelect);

    if (where) {
      pivot = pivot.where(where).noop();
    }

    pivot = pivot
      .join(targetModel.table)
      .on(pivotLeftOperand, pivotRightOperand)
      .noop();

    const leftOperand = [sourceModelDef.table, this.model.primaryKey].join('.');
    const rightOperand = `"${definition.association}"."${definition.through}.${sourceKeyOnPivot}"`;
    return builder
      .leftJoin({value: pivot, as: definition.association})
      .on(leftOperand, rightOperand)
      .noop();
  }
});

const oneToMany = Object.assign({}, selectFieldsBehaviour, {
  join(builder, where){
    let outputBuilder = builder;
    const {definition, model:sourceModel} = this;
    const targetModel = this.sh.model(definition.model);
    const leftOperand = [sourceModel.definition.table, sourceModel.primaryKey].join('.');
    const foreignKey = getReverseAssociation(sourceModel, definition, this.sh).foreignKey;
    const rightOperand = `"${definition.association}"."${foreignKey}"`;
    const fromClause = getFromClause(targetModel, this.nested);

    outputBuilder = builder
      .leftJoin({value: fromClause, as: definition.association})
      .on(leftOperand, rightOperand);
    return eventuallyAddWhere(outputBuilder, where);
  }
});

const manyToOne = Object.assign({}, selectFieldsBehaviour, {
  join(builder, where){
    let outputBuilder = builder;
    const {definition, model:sourceModel} = this;
    const targetModel = this.sh.model(definition.model);
    const leftOperand = [sourceModel.definition.table, definition.foreignKey].join('.');
    const rightOperand = `"${definition.association}"."${targetModel.primaryKey}"`;
    const fromClause = getFromClause(targetModel, this.nested);

    outputBuilder = builder
      .leftJoin({value: fromClause, as: definition.association})
      .on(leftOperand, rightOperand);
    return eventuallyAddWhere(outputBuilder, where)
  }
});

const oneToOne = Object.assign({}, selectFieldsBehaviour, {
  join(builder, where){
    let outputBuilder = builder;
    const definition = this.definition;
    const targetModel = this.sh.model(definition.model);
    const sourceModel = this.model;
    const foreignKey = getReverseAssociation(sourceModel, definition, this.sh).foreignKey;
    const leftOperand = [sourceModel.definition.table, sourceModel.primaryKey].join('.');
    const rightOperand = `"${definition.association}"."${foreignKey}"`;
    const fromClause = getFromClause(targetModel, this.nested);

    outputBuilder = builder
      .leftJoin({value: fromClause, as: definition.association})
      .on(leftOperand, rightOperand);

    return eventuallyAddWhere(outputBuilder, where);
  }
});

exports.relationFactory = function relationFactory (sourceModel, association) {
  let rootRelation;
  if (!association.relation) {
    throw new Error('invalid association definition');
  }
  const shiphold = sourceModel.shiphold;
  const props = {
    model: {
      value: sourceModel
    },
    sh: {
      value: shiphold
    },
    definition: {
      value: association
    }
  };
  switch (association.relation) {
    case 'belongsToMany':
      rootRelation = Object.create(manyToMany, props);
      break;
    case 'hasMany':
      rootRelation = Object.create(oneToMany, props);
      break;
    case 'belongsTo':
      rootRelation = Object.create(manyToOne, props);
      break;
    case 'hasOne':
      rootRelation = Object.create(oneToOne, props);
      break;
    default:
      throw new Error('unknown relation ' + association.relation);
  }
  if (association.nested) {
    rootRelation.nested = association.nested.map(n=>relationFactory(shiphold.model(n.model), n));
  }
  return rootRelation;
};