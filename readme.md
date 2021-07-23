# Prismix
Prisma schemas are required to be in a single file currently, this tool will intelligently merge many prisma schemas into one. 

Unlike `prisma-merge`, Prismix allows for cross-file data relations by combining models and enums, allowing you to extend and override Models as you please. This is ideal when working in a monorepos where parts of your schema needs to exist in other modules.


## Installation
1. Install Prismix
```
yarn add prismix
```
2. Create a `prismix.config.json` file. This allows you to define how you would like Prismix to merge your schemas. 
```json
{
  "mixers": [
    {
        "input": [
            "./base.prisma",
            "../lib/auth/auth.prisma", 
            "../lib/posts/posts.prisma",
        ],
        "output": "prisma/schema.prisma"
    }
  ],
  "runMigrationsOnStart": true,
}
```
2. Add the `npx prismix` command as a prefix to your `package.json` scripts.
```json
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "npx prismix && ts-node server.ts",
  }
}

```

## Example
Let's go over how Prismix merges schemas. We'll keep it simple here and start with two schemas, but they need to relate to each other.

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
    posts: Post[]
}
```
When Prismix merges these two schemas the relations will be connected. 

## `schema.prisma`
This is the generated file

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
    posts:   Post[]
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