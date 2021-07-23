# `Prismix`
 
### *The Prisma schema mixer 🍜*

_Made for Prisma v2_

Prisma requires your schema to be written in a single file, Prismix allows you to write as many schema files as you'd like, wherever you like—all while supporting cross-file model relations 🤯

Unlike `prisma-merge`, Prismix allows model relations to exist between files by combining models and enums, allowing you to extend and override Models as you please. This is ideal when working in a monorepo where parts of your schema needs to exist in other modules.


## Installation
1. Install Prismix
```
yarn add prismix --dev
```
2. Create a `prismix.config.json` file. This allows you to define how you would like Prismix to merge your schemas. 
```json
{
  "mixers": [
    {
        "input": [
            "base.prisma",
            "../lib/auth/auth.prisma", 
            "../lib/posts/posts.prisma",
        ],
        "output": "prisma/schema.prisma"
    }
  ]
}
```
The order of your input files effects how overrides are considered, the later inputs take priority over the earlier inputs.
The default `output` value is `prisma/schema.prisma` and Prisma encourages you to keep is as such, especially if you want to use `prisma format`.

2. Add the `npx prismix` command as a prefix to your `package.json` scripts.
```json
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "prismix": "npx prismix && prisma format",
    "dev": "yarn prismix && ts-node server.ts",
  }
}
```
Using `prisma format` is optional, but I like clean code.

Or just run `npx prismix` from within the repo that contains the Prismix config file. 

Note: If you are using a monorepo you won't be able to run this command from the root, if you add a script `"prismix": "npx prismix"` you could run `yarn workspace my-app prismix`.


## Example
Let's go over how Prismix merges schemas. We'll keep it simple with two schemas that need to relate to each other.

## `base.prisma`


```prisma
generator client {
    provider = "prisma-client-js"
}

datasource db {
    provider = "postgresql"
    url      = "postgresql://..."
}

model Account {
    id       Int    @id @default(autoincrement())
    username String
    email    String
    status   String

    @@map("accounts")
}
```
We've established our `generator` and `datasource`, as well as our first model, `Account`. 

## `posts.prisma`
Now we'll create the Posts schema in a different file. In order for posts to relate to accounts we can define an empty model to represent the account.

```prisma
model Posts {
    id         Int     @id @default(autoincrement())
    title      String
    content    String
    account_id Int
    account    Account @relation(fields: [account_id], references: [id])

    @@map("posts")
}

model Account {
    id     String
    posts  Post[]
}
```
When Prismix merges these two schemas the relations will be connected. 

## `schema.prisma`
This is the generated file:

```prisma
generator client {
    provider = "prisma-client-js"
}

datasource db {
    provider = "postgresql"
    url      = "postgresql://..."
}

model Account {
    id       Int    @id @default(autoincrement())
    username String
    email    String
    status   String
    posts    Post[]
}

model Posts {
    id         Int     @id @default(autoincrement())
    title      String
    content    String
    account_id Int
    account    Account @relation(fields: [account_id], references: [id])

    @@map("posts")
}
```

As you can see the property `posts` was added on to the original Account schema and the `account` relation on the Posts schema links to the original Account schema.



## How it works
Using the Prisma SDK we parse the input schemas into a DMMF objects, then process the schema merge into a single DMMF object, finally it is converted back into Prisma schema format manually using deserializer code I found on IBM's GitHub... and cleaned up massively.


## To-do
- [x] Make it work
- [ ] Add glog support for wildcard schema discovery
- [ ] Make `prismix.config.json` optional
- [ ] Add command flags
