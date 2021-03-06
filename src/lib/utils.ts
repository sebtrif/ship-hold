import {EntityService, InclusionInput, RelationArgument, SelectServiceBuilder} from '../interfaces';

const isNormalized = (val: RelationArgument): val is InclusionInput => {
    return typeof val === 'object' && 'as' in val;
};

export const normaliseInclude = (aliasToService: Map<string, EntityService>, targetBuilder: SelectServiceBuilder) =>
    (rel: RelationArgument): InclusionInput => {

        if (isNormalized(rel)) {
            return rel;
        }

        // Alias
        if (typeof rel === 'string') {
            const service = aliasToService.get(rel);
            return {value: service.select(), as: rel};
        }

        const builder = <SelectServiceBuilder>('build' in rel ? rel : rel.select()).noop();
        const as = targetBuilder.service.getRelationWith(builder.service).alias;

        return {
            value: builder,
            as
        };
    };

const uppercaseTheFirstLetter = (word: string): string => {
    const [first, ...rest] = word;
    return [first.toUpperCase(), ...rest].join('');
};

export const toCamelCase = (input: string): string => {
    return input
        .split('_')
        .map(uppercaseTheFirstLetter)
        .join();
};
