const test = require('zora');

module.exports = function (sh) {
    let usersFixture;
    let productsFixture;
    let phonesFixture;

    const fixtureFactory = items => (filterFunc = x => true) => items.map(i => Object.assign({}, i)).filter(filterFunc);

    function createServices() {
        const Users = sh.service({
            table: 'users_association_select',
            primaryKey: 'id',
            name: 'Users'
        });

        const Products = sh.service({
            table: 'products_association_select',
            name: 'Products',
            primaryKey: 'id'
        });

        const Phones = sh.service({
            table: 'phones_association_select',
            name: 'Phones',
            primaryKey: 'id'
        });

        const Accounts = sh.service({
            name: 'Accounts',
            table: 'accounts_association_select',
            primaryKey: 'id'
        });

        const UsersAccounts = sh.service({
            table: 'users_accounts_associations_select',
            name: 'UsersAccounts',
            primaryKey: 'id'
        });

        Users.hasMany(Products, 'products');
        Products.belongsTo(Users, 'user_id', 'owner');

        return {Users, Products, Phones, Accounts};
    }

    return test('select with include', async t => {

        await t.test('add user fixture', async t => {
            const {query} = sh;
            const {rows} = await query(`INSERT INTO users_association_select(name, age) 
      VALUES 
      ('Laurent',29),
      ('Jesus', 2016),
      ('Raymond',55),
      ('Blandine',29),
      ('Olivier',31),
      ('Francoise',58)
      RETURNING *`);

            usersFixture = fixtureFactory(rows);

            t.equal(rows.length, 6);
        });

        await t.test('add products fixture', async t => {
            const {query} = sh;
            const {rows} = await query(`INSERT INTO products_association_select(price, sku,title,user_id) 
      VALUES 
      (9.99,'sgl','sun glasses',2),
      (49.5,'kbd','key board',1),
      (20,'sbg','small bag',1),
      (25.99,'sht','shirt',NULL),
      (99.9,'wdr','white dress',4),
      (5.75,'tdb','teddy bear',NULL)
      RETURNING *`);

            productsFixture = fixtureFactory(rows);

            t.equal(rows.length, 6, 'should have created 6 products');
        });

        await t.test('add phones fixture', async t => {
            const {query} = sh;
            const {rows} = await query(`INSERT INTO phones_association_select(number,user_id)
      VALUES ('123456789',1),('987654321',3) RETURNING *`);
            phonesFixture = fixtureFactory(rows);
            t.equal(rows.length, 2, 'should have two rows');
        });

        await t.test('add accounts fixture', async t => {
            const {query} = sh;
            const queryText = `INSERT INTO accounts_association_select(balance) VALUES
    (200.42),
    (-20.56),
    (42.42),
    (51.2)
    RETURNING *`;
            const pivotq = `INSERT INTO users_accounts_association_select(user_id,account_id) VALUES
    (1,1),
    (1,2),
    (2,1),
    (2,3),
    (2,4)
      RETURNING *
    `;

            const {rows} = await query(queryText);
            t.equal(rows.length, 4, 'should have inserted 4 accounts');
            const {rows: pivotRows} = await query(pivotq);
            t.equal(pivotRows.length, 5, 'should have inserted 5 relations');
        });

        /*
        t.test('one to one: load al users with their phone number (service notation)', async t => {
            const {Users, Phones} = createservices();
            const expected = usersFixture()
                .map(u => Object.assign(u, {
                    phone: phonesFixture(p => p.user_id === u.id)
                        .map(({id, number}) => ({id, number}))[0] || null
                }));
            const builder = Users
                .select()
                .orderBy('id')
                .include(Phones.select('id', 'number'));

            const users = await builder.run();
            t.deepEqual(users, expected);
        });

        t.test('one to one: load al users with their phone number (builder notations)', async t => {
            const {Users, Phones} = createservices();
            const expected = usersFixture()
                .map(u => Object.assign(u, {phone: phonesFixture(p => p.user_id === u.id)[0] || null}));
            const builder = Users
                .select()
                .orderBy('id')
                .include(Phones.select());

            t.deepEqual(builder.build().text, `SELECT "users_association_select".*, "phone"."id" AS "phone.id", "phone"."number" AS "phone.number", "phone"."user_id" AS "phone.user_id" FROM (SELECT * FROM "users_association_select" ORDER BY "id") AS "users_association_select" LEFT JOIN (SELECT * FROM "phones_association_select") AS "phone" ON "users_association_select"."id" = "phone"."user_id" ORDER BY "id"`);
            const users = await builder.run();
            t.deepEqual(users, expected);
        });

        t.test('one to one: load al users with their phone number (string notation)', async t => {
            const {Users} = createservices();
            const expected = usersFixture()
                .map(u => Object.assign(u, {phone: phonesFixture(p => p.user_id === u.id)[0] || null}));
            const builder = Users
                .select()
                .orderBy('id')
                .include('phone');

            t.deepEqual(builder.build().text, `SELECT "users_association_select".*, "phone"."id" AS "phone.id", "phone"."number" AS "phone.number", "phone"."user_id" AS "phone.user_id" FROM (SELECT * FROM "users_association_select" ORDER BY "id") AS "users_association_select" LEFT JOIN (SELECT * FROM "phones_association_select") AS "phone" ON "users_association_select"."id" = "phone"."user_id" ORDER BY "id"`);
            const users = await builder.run();
            t.deepEqual(users, expected);
        });

        t.test('one to Many: load all users with their products (service notation)', async t => {
            const {Users, Products} = createservices();
            const builder = Users
                .select()
                .orderBy('id')
                .include(Products);

            t.deepEqual(builder.build().text, `SELECT "users_association_select".*, "products"."id" AS "products.id", "products"."sku" AS "products.sku", "products"."title" AS "products.title", "products"."price" AS "products.price", "products"."user_id" AS "products.user_id" FROM (SELECT * FROM "users_association_select" ORDER BY "id") AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select") AS "products" ON "users_association_select"."id" = "products"."user_id" ORDER BY "id"`);

            const users = await builder.run();

            const expected = usersFixture();
            expected[0].products = productsFixture(p => p.user_id === 1);
            expected[1].products = productsFixture(p => p.user_id === 2);
            expected[2].products = [];
            expected[3].products = productsFixture(p => p.user_id === 4);
            expected[4].products = [];
            expected[5].products = [];

            t.deepEqual(users, expected);
        });

        t.test('one to Many: load al users with their products (string notation)', async t => {
            const {Users} = createservices();
            const builder = Users
                .select()
                .orderBy('id')
                .include('products');
            t.equal(builder.build().text, `SELECT "users_association_select".*, "products"."id" AS "products.id", "products"."sku" AS "products.sku", "products"."title" AS "products.title", "products"."price" AS "products.price", "products"."user_id" AS "products.user_id" FROM (SELECT * FROM "users_association_select" ORDER BY "id") AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select") AS "products" ON "users_association_select"."id" = "products"."user_id" ORDER BY "id"`);
            const users = await builder.run();
            const expected = usersFixture().map(u => Object.assign(u, {
                products: productsFixture(p => p.user_id === u.id)
            }));
            t.deepEqual(users, expected);
        });
        */

        t.test('one to many: specify fields (builder notation)', async t => {
            const {Users, Products} = createServices();
            const builder = Users
                .select('id', 'name')
                .orderBy('id')
                .include(Products.select('id', 'sku', 'user_id').orderBy('id'));

            // t.equal(builder.build().text, `SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "products"."id" AS "products.id", "products"."sku" AS "products.sku" FROM (SELECT * FROM "users_association_select" ORDER BY "id") AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select") AS "products" ON "users_association_select"."id" = "products"."user_id" ORDER BY "id"`);

            const users = await builder.run();

            t.deepEqual(users, [
                {name: 'Laurent', id: 1, products: [{sku: 'kbd', id: 2, user_id: 1}, {id: 3, user_id: 1, sku: 'sbg'}]},
                {name: 'Jesus', id: 2, products: [{sku: 'sgl', user_id: 2, id: 1}]},
                {name: 'Raymond', id: 3, products: []},
                {name: 'Blandine', id: 4, products: [{sku: 'wdr', user_id: 4, id: 5}]},
                {name: 'Olivier', id: 5, products: []},
                {name: 'Francoise', id: 6, products: []}
            ]);
        });

        /*
        t.test('one to many: filter on target service', async t => {
            const {Users, Products} = createservices();
            const builder = Users
                .select('id', 'name')
                .where('name', 'Laurent')
                .include(Products.select('id', 'sku'));

            t.equal(builder.build().text, `SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "products"."id" AS "products.id", "products"."sku" AS "products.sku" FROM (SELECT * FROM "users_association_select" WHERE "name" = 'Laurent') AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select") AS "products" ON "users_association_select"."id" = "products"."user_id"`);

            const users = await builder.run();
            t.deepEqual(users, [{id: 1, name: 'Laurent', products: [{sku: 'kbd', id: 2}, {id: 3, sku: 'sbg'}]}]);
        });

        t.test('one to many: order and limit on target service', async t => {
            const {Users, Products} = createservices();
            const builder = Users
                .select('id', 'name', 'age')
                .where('age', '<', 50)
                .orderBy('name', 'asc')
                .limit(2)
                .include(Products.select('id', 'sku'));
            const expected = [
                {id: 4, name: 'Blandine', age: 29, products: [{sku: 'wdr', id: 5}]},
                {id: 1, name: 'Laurent', age: 29, products: [{sku: 'kbd', id: 2}, {sku: 'sbg', id: 3}]}
            ];

            t.equal(builder.build().text, `SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "users_association_select"."age" AS "age", "products"."id" AS "products.id", "products"."sku" AS "products.sku" FROM (SELECT * FROM "users_association_select" WHERE "age" < 50 ORDER BY "name" ASC LIMIT 2) AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select") AS "products" ON "users_association_select"."id" = "products"."user_id" ORDER BY "name" ASC`);

            const users = await builder.run();
            t.deepEqual(users, expected);
        });

        t.test('one to many: filter on included service', async t => {
            try {
                const {Users, Products} = createservices();
                const expected = [
                    {id: 1, name: 'Laurent', products: [{id: 3, sku: 'sbg', price: 20, title: 'small bag', user_id: 1}]}
                ];
                const builder = Users
                    .select('id', 'name')
                    .where('name', 'Laurent')
                    .include(Products.select().where('price', '<', 30));

                t.equal(builder.build().text, `SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "products"."id" AS "products.id", "products"."sku" AS "products.sku", "products"."title" AS "products.title", "products"."price" AS "products.price", "products"."user_id" AS "products.user_id" FROM (SELECT * FROM "users_association_select" WHERE "name" = 'Laurent') AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select" WHERE "price" < 30) AS "products" ON "users_association_select"."id" = "products"."user_id"`);

                const users = await builder.run();

                t.deepEqual(users, expected);
            } catch (e) {
                console.log(e);
            }
        });

        t.test('many to one: specify fields (string notation)', async t => {
            const {Products} = createservices();
            const expected = productsFixture()
                .map(({id, title, user_id}) => ({id, title, user_id}))
                .map(p => Object.assign({}, p, {owner: usersFixture(u => u.id === p.user_id)[0] || null}))
                .map(p => {
                    delete p.user_id;
                    return p;
                });

            const builder = Products
                .select('id', 'title')
                .orderBy('id')
                .include('owner');

            t.equal(builder.build().text, `SELECT "products_association_select"."id" AS "id", "products_association_select"."title" AS "title", "owner"."id" AS "owner.id", "owner"."age" AS "owner.age", "owner"."name" AS "owner.name" FROM (SELECT * FROM "products_association_select" ORDER BY "id") AS "products_association_select" LEFT JOIN (SELECT * FROM "users_association_select") AS "owner" ON "products_association_select"."user_id" = "owner"."id" ORDER BY "id"`);

            const products = await builder.run();

            t.deepEqual(products, expected);
        });

        t.test('many to one: specify fields (builder notation)', async t => {
            const {Products, Users} = createservices();
            const expected = productsFixture()
                .map(({id, title, user_id}) => ({
                    id,
                    title,
                    user_id
                }))
                .map(p => Object.assign({}, p, {owner: usersFixture(u => u.id === p.user_id)[0] || null}))
                .map(p => {
                    delete p.user_id;
                    p.owner = p.owner ? {name: p.owner.name, id: p.owner.id} : p.owner;
                    return p;
                });

            const builder = await Products
                .select('id', 'title')
                .orderBy('id')
                .include(Users.select('id', 'name'));

            t.deepEqual(builder.build().text, `SELECT "products_association_select"."id" AS "id", "products_association_select"."title" AS "title", "owner"."id" AS "owner.id", "owner"."name" AS "owner.name" FROM (SELECT * FROM "products_association_select" ORDER BY "id") AS "products_association_select" LEFT JOIN (SELECT * FROM "users_association_select") AS "owner" ON "products_association_select"."user_id" = "owner"."id" ORDER BY "id"`);

            const products = await builder.run();

            t.deepEqual(products, expected);
        });

        t.test('many to one: filter on target service', async t => {
            const {Products, Users} = createservices();
            const expected = [{id: 5, title: 'white dress', owner: {id: 4, name: 'Blandine'}}];
            const builder = Products
                .select('title', 'id')
                .where('title', 'white dress')
                .include(Users.select('id', 'name'));
            t.equal(builder.build().text, `SELECT "products_association_select"."title" AS "title", "products_association_select"."id" AS "id", "owner"."id" AS "owner.id", "owner"."name" AS "owner.name" FROM (SELECT * FROM "products_association_select" WHERE "title" = 'white dress') AS "products_association_select" LEFT JOIN (SELECT * FROM "users_association_select") AS "owner" ON "products_association_select"."user_id" = "owner"."id"`);

            const products = await builder.run();

            t.deepEqual(products, expected);
        });

        t.test('many to one: order and limit on target service', async t => {
            const {Products, Users} = createservices();
            const expected = [
                {id: 6, title: 'teddy bear', price: 5.75, owner: null},
                {id: 1, title: 'sun glasses', price: 9.99, owner: {id: 2, name: 'Jesus'}}
            ];
            const builder = Products
                .select('id', 'title', 'price')
                .orderBy('price')
                .limit(2)
                .where('price', '<=', 20)
                .include(Users.select('name', 'id'));

            t.equal(builder.build().text, `SELECT "products_association_select"."id" AS "id", "products_association_select"."title" AS "title", "products_association_select"."price" AS "price", "owner"."name" AS "owner.name", "owner"."id" AS "owner.id" FROM (SELECT * FROM "products_association_select" WHERE "price" <= 20 ORDER BY "price" LIMIT 2) AS "products_association_select" LEFT JOIN (SELECT * FROM "users_association_select") AS "owner" ON "products_association_select"."user_id" = "owner"."id" ORDER BY "price"`);

            const actual = await builder.run();

            t.deepEqual(actual, expected);
        });

        t.test('many to many', async t => {
            const {Users, Accounts} = createservices();
            const expected = [
                {id: 1, name: 'Laurent', accounts: [{id: 1, balance: 200.42}, {id: 2, balance: -20.56}]},
                {
                    id: 2,
                    name: 'Jesus',
                    accounts: [{id: 1, balance: 200.42}, {id: 3, balance: 42.42}, {id: 4, balance: 51.2}]
                },
                {id: 3, name: 'Raymond', accounts: []},
                {id: 4, name: 'Blandine', accounts: []},
                {id: 5, name: 'Olivier', accounts: []},
                {id: 6, name: 'Francoise', accounts: []},
            ];
            const builder = Users
                .select('id', 'name')
                .orderBy('id')
                .include(Accounts.select('id', 'balance'));

            t.deepEqual(builder.build().text, `SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "accounts"."id" AS "accounts.id", "accounts"."balance" AS "accounts.balance" FROM (SELECT * FROM "users_association_select" ORDER BY "id") AS "users_association_select" LEFT JOIN (SELECT "users_accounts_association_select"."user_id" AS "UsersAccounts.user_id", "users_accounts_association_select"."account_id" AS "UsersAccounts.account_id", "accounts_association_select".* FROM "users_accounts_association_select" JOIN (SELECT * FROM "accounts_association_select") AS "accounts_association_select" ON "users_accounts_association_select"."account_id" = "accounts_association_select"."id") AS "accounts" ON "users_association_select"."id" = "accounts"."UsersAccounts.user_id" ORDER BY "id"`);

            const users = await builder.run();
            t.deepEqual(users, expected);

        });

        t.test('many to many: filter on base service', async t => {
            const {Users, Accounts} = createservices();
            const builder = Users
                .select('id', 'name')
                .where('id', 1)
                .include(Accounts.select('id', 'balance'));

            t.deepEqual(builder.build().text, `SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "accounts"."id" AS "accounts.id", "accounts"."balance" AS "accounts.balance" FROM (SELECT * FROM "users_association_select" WHERE "id" = 1) AS "users_association_select" LEFT JOIN (SELECT "users_accounts_association_select"."user_id" AS "UsersAccounts.user_id", "users_accounts_association_select"."account_id" AS "UsersAccounts.account_id", "accounts_association_select".* FROM "users_accounts_association_select" JOIN (SELECT * FROM "accounts_association_select") AS "accounts_association_select" ON "users_accounts_association_select"."account_id" = "accounts_association_select"."id") AS "accounts" ON "users_association_select"."id" = "accounts"."UsersAccounts.user_id"`);

            const users = await builder.run();
            t.deepEqual(users, [{
                id: 1,
                name: 'Laurent',
                accounts: [{id: 1, balance: 200.42}, {id: 2, balance: -20.56}]
            }]);
        });

        t.test('many to many: filter on include', async t => {
            const {Users, Accounts} = createservices();
            const expected = [
                {id: 1, name: 'Laurent', accounts: [{id: 1, balance: 200.42}]},
                {
                    id: 2,
                    name: 'Jesus',
                    accounts: [{id: 1, balance: 200.42}, {id: 3, balance: 42.42}, {id: 4, balance: 51.2}]
                },
                {id: 3, name: 'Raymond', accounts: []},
                {id: 4, name: 'Blandine', accounts: []},
                {id: 5, name: 'Olivier', accounts: []},
                {id: 6, name: 'Francoise', accounts: []}
            ];
            const builder = Users
                .select('id', 'name')
                .orderBy('id')
                .include(Accounts.select().where('balance', '>', 0));

            t.equal(builder.build().text, `SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "accounts"."id" AS "accounts.id", "accounts"."balance" AS "accounts.balance" FROM (SELECT * FROM "users_association_select" ORDER BY "id") AS "users_association_select" LEFT JOIN (SELECT "users_accounts_association_select"."user_id" AS "UsersAccounts.user_id", "users_accounts_association_select"."account_id" AS "UsersAccounts.account_id", "accounts_association_select".* FROM "users_accounts_association_select" JOIN (SELECT * FROM "accounts_association_select" WHERE "balance" > 0) AS "accounts_association_select" ON "users_accounts_association_select"."account_id" = "accounts_association_select"."id") AS "accounts" ON "users_association_select"."id" = "accounts"."UsersAccounts.user_id" ORDER BY "id"`);

            const actual = await builder.run();

            t.deepEqual(actual, expected);
        });

        t.test('combo', async t => {
            const {Users, Products, Phones, Accounts} = createservices();
            const expected = [{
                accounts: [
                    {balance: 200.42, id: 1},
                    {balance: -20.56, id: 2}
                ],
                id: 1,
                name: 'Laurent',
                phone: {id: 1, number: '123456789', user_id: 1},
                products: [
                    {id: 2, price: 49.5, sku: 'kbd', title: 'key board', user_id: 1},
                    {
                        id: 3,
                        price: 20,
                        sku: 'sbg',
                        title: 'small bag',
                        user_id: 1
                    }
                ]
            }];
            const builder = Users
                .select('id', 'name')
                .where('id', 1)
                .include(Products, Phones, Accounts);

            t.deepEqual(builder.build().text, `SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "products"."id" AS "products.id", "products"."sku" AS "products.sku", "products"."title" AS "products.title", "products"."price" AS "products.price", "products"."user_id" AS "products.user_id", "phone"."id" AS "phone.id", "phone"."number" AS "phone.number", "phone"."user_id" AS "phone.user_id", "accounts"."id" AS "accounts.id", "accounts"."balance" AS "accounts.balance" FROM (SELECT * FROM "users_association_select" WHERE "id" = 1) AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select") AS "products" ON "users_association_select"."id" = "products"."user_id" LEFT JOIN (SELECT * FROM "phones_association_select") AS "phone" ON "users_association_select"."id" = "phone"."user_id" LEFT JOIN (SELECT "users_accounts_association_select"."user_id" AS "UsersAccounts.user_id", "users_accounts_association_select"."account_id" AS "UsersAccounts.account_id", "accounts_association_select".* FROM "users_accounts_association_select" JOIN (SELECT * FROM "accounts_association_select") AS "accounts_association_select" ON "users_accounts_association_select"."account_id" = "accounts_association_select"."id") AS "accounts" ON "users_association_select"."id" = "accounts"."UsersAccounts.user_id"`);
            const users = await builder.run();
            t.deepEqual(users, expected);
        });

        t.test('include multiple services', async t => {
            const {Users, Products, Phones} = createservices();
            const expected = [{
                id: 1,
                name: 'Laurent',
                phone: {id: 1, number: '123456789'},
                products: [{id: 2, title: 'key board'}, {id: 3, title: 'small bag'}]
            }];
            const builder = Users
                .select('name', 'id')
                .where('id', 1)
                .include(Products.select('id', 'title'), Phones.select('id', 'number'));

            t.equal(builder.build().text, `SELECT "users_association_select"."name" AS "name", "users_association_select"."id" AS "id", "products"."id" AS "products.id", "products"."title" AS "products.title", "phone"."id" AS "phone.id", "phone"."number" AS "phone.number" FROM (SELECT * FROM "users_association_select" WHERE "id" = 1) AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select") AS "products" ON "users_association_select"."id" = "products"."user_id" LEFT JOIN (SELECT * FROM "phones_association_select") AS "phone" ON "users_association_select"."id" = "phone"."user_id"`);
            const actual = await builder.run();
            t.deepEqual(actual, expected);
        });

        t.test('nested include', async t => {
            const {Phones, Users, Products} = createservices();
            const expected = [{
                id: 1,
                number: '123456789',
                user_id: 1,
                human: {
                    id: 1, name: 'Laurent', products: [
                        {id: 3, sku: 'sbg'},
                        {id: 2, sku: 'kbd'}
                    ]
                }
            }, {
                human: {
                    id: 3,
                    name: 'Raymond',
                    products: []
                },
                id: 2,
                number: '987654321',
                user_id: 3
            }];

            const builder = Phones
                .select()
                .include(
                    Users.select('id', 'name')
                        .include(Products.select('id', 'sku'))
                );

            t.deepEqual(builder.build().text, `SELECT "phones_association_select".*, "human"."id" AS "human.id", "human"."name" AS "human.name", "human"."products.id" AS "human.products.id", "human"."products.sku" AS "human.products.sku" FROM (SELECT * FROM "phones_association_select") AS "phones_association_select" LEFT JOIN (SELECT "users_association_select"."id" AS "id", "users_association_select"."name" AS "name", "products"."id" AS "products.id", "products"."sku" AS "products.sku" FROM (SELECT * FROM "users_association_select") AS "users_association_select" LEFT JOIN (SELECT * FROM "products_association_select") AS "products" ON "users_association_select"."id" = "products"."user_id") AS "human" ON "phones_association_select"."user_id" = "human"."id"`);
            const phones = await builder.run();
            t.deepEqual(phones, expected);
        });

        t.test('multiple service at nested level', async t => {
            const {Products, Users, Accounts} = createservices();
            const expected = [{
                id: 2,
                owner: {
                    accounts: [{balance: 200.42, id: 1}, {balance: -20.56, id: 2}],
                    age: 29,
                    id: 1,
                    name: 'Laurent',
                    phone: {id: 1, number: '123456789', user_id: 1}
                },
                price: 49.5,
                sku: 'kbd',
                title: 'key board',
                user_id: 1
            }
            ];
            const builder = Products
                .select()
                .where('id', '$id')
                .include(Users.select().include('phone', Accounts.select().orderBy('id')));

            t.equal(builder.build({id: 2}).text, `SELECT "products_association_select".*, "owner"."id" AS "owner.id", "owner"."age" AS "owner.age", "owner"."name" AS "owner.name", "owner"."phone.id" AS "owner.phone.id", "owner"."phone.number" AS "owner.phone.number", "owner"."phone.user_id" AS "owner.phone.user_id", "owner"."accounts.id" AS "owner.accounts.id", "owner"."accounts.balance" AS "owner.accounts.balance" FROM (SELECT * FROM "products_association_select" WHERE "id" = $1) AS "products_association_select" LEFT JOIN (SELECT "users_association_select".*, "phone"."id" AS "phone.id", "phone"."number" AS "phone.number", "phone"."user_id" AS "phone.user_id", "accounts"."id" AS "accounts.id", "accounts"."balance" AS "accounts.balance" FROM (SELECT * FROM "users_association_select") AS "users_association_select" LEFT JOIN (SELECT * FROM "phones_association_select") AS "phone" ON "users_association_select"."id" = "phone"."user_id" LEFT JOIN (SELECT "users_accounts_association_select"."user_id" AS "UsersAccounts.user_id", "users_accounts_association_select"."account_id" AS "UsersAccounts.account_id", "accounts_association_select".* FROM "users_accounts_association_select" JOIN (SELECT * FROM "accounts_association_select" ORDER BY "id") AS "accounts_association_select" ON "users_accounts_association_select"."account_id" = "accounts_association_select"."id") AS "accounts" ON "users_association_select"."id" = "accounts"."UsersAccounts.user_id") AS "owner" ON "products_association_select"."user_id" = "owner"."id"`);

            const products = await builder.run({id: 2});
            t.deepEqual(products, expected);
        });
        */
    });
};
