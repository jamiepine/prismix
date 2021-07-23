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

`base.prisma`

This is the 
```prisma
generator client {
    provider = "prisma-client-js"
}

datasource db {
    provider = "postgresql"
    url      = "postgresql://..."
}

model Account {
    id   Int  @id @default(autoincrement())
    plan Plan

    @@map("accounts")
}
```