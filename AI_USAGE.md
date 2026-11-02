# AI Usage

Most of the code in this project was written with AI assistance. The architecture and design decisions are my own.

## What I did

- Designed the overall architecture: separate frontend, backend, and database folders, with the frontend as a static site, the backend as a containerized FastAPI service, and Supabase (PostgreSQL) as the database.
- Chose the technology stack, including vanilla JS for the frontend to reduce security vulnerabilities.
- Decided that all database logic lives in functions in the `api` schema, exposed only to the backend role.
- Defined the API structure, authentication model, and deployment approach.
- Reviewed, tested, and directed the AI-generated output.

## What AI did

- Generated most of the implementation: frontend pages, backend endpoints, SQL functions, CI workflows, and documentation.
- Assisted with debugging, configuration, and drafting documentation.

## Responsibility

AI-generated code was reviewed and integrated by me, and I am responsible for the final project. Automated checks (CodeQL, Ruff, and Backend CI) run on the repository to catch issues in the generated code.