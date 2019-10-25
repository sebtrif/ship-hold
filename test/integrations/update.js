const {wrapWithShipHold} = require('../util.js');

module.exports = wrapWithShipHold(async function (t, sh) {

    let fixtures;
    const fixtureFactory = (items) => (filterFunc = x => true) => items.map(i => Object.assign({}, i)).filter(filterFunc);

    const createService = () => sh.service({
        table: 'users_update',
        name: 'Users'
    });

    await t.test(`create schema`, async t => {
        await sh.query('DROP TABLE IF EXISTS users_update');
        t.ok(await sh.query(`CREATE TABLE users_update (
            id serial PRIMARY KEY,
            age integer,
            name varchar(100)
        );`));
    });

    await t.test('add fixture', async t => {
        const {query} = sh;
        const result = await query(`INSERT INTO users_update(name, age)
        VALUES
        ('Laurent',29),
        ('Jesus',2016),
        ('Raymond',55),
        ('Blandine',29)
        RETURNING *;
        `);

        fixtures = fixtureFactory(result.rows);
        t.equal(result.rows.length, 4);
    });

    await t.test('update a bunch of rows', async t => {
        const users = await createService()
            .update()
            .set('age', '$age')
            .where('age', 29)
            .run({age: 30});

        t.deepEqual(users, fixtures(i => i.age === 29).map(i => Object.assign({}, i, {age: 30})));
    });

    await t.test('update a bunch of rows using object notation', async t => {
        const users = await createService()
            .update()
            .set({name: '$name'})
            .where('name', 'Jesus')
            .run({name: 'updated'});

        t.deepEqual(users, fixtures(t => t.name === 'Jesus').map(i => Object.assign({}, i, {name: 'updated'})));
    });

    await t.test('update a bunch of rows without service', async t => {
        const users = await sh
            .update('users_update')
            .set({name: '$name'})
            .where('name', 'updated')
            .returning('*')
            .run({name: 'not updated anymore'});

        t.deepEqual(users, fixtures(t => t.name === 'Jesus').map(i => Object.assign({}, i, {name: 'not updated anymore'})));
    });
});
