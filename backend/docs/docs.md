# **Purpose: Centralizing Knowledge and Streamlining Collaboration** 

The `docs` folder serves as a comprehensive knowledge base for our development team.  By integrating essential documentation directly within our project's codebase, we foster a shared understanding and promote long-term maintainability.

**Key Benefits**

* **Seamless Knowledge Transfer:** Documentation lives alongside the code it references, ensuring everyone has immediate access to project history, design decisions, and best practices.
* **Streamlined Onboarding:** New developers can quickly grasp the project's rationale, structure, and processes by exploring the `docs` folder.
* **Consistent Evolution:** Version control tracks documentation changes alongside our code, providing a historical record of how our project and its understanding have matured.
* **Focused Content:** We can use Markdown or plain text formats for ease of editing, keeping the emphasis on valuable knowledge rather than complex tooling.

**Advantages over External Document Stores**

While tools like Notion or Google Docs excel in certain areas, embedding engineering-centric documents within version control offers distinct advantages:

* **Direct Context:** Information remains tightly coupled to the code it relates to, reducing the need to search across multiple platforms.
* **Reduced Fragmentation:**  This approach minimizes the risk of discrepancies between code and outdated external documentation.
* **Offline Accessibility:** Documentation remains available even without an internet connection.
* **Developer Familiarity:**  Using Markdown or plain text formats aligns with developers' existing workflows and tools.


**Recommendations for an Effective Knowledge Base**

* **Descriptive Naming:**  Choosing a name like `knowledge-base` or `team-docs` clearly conveys the folder's purpose for all team members.
* **Structured Organization:**  Create subfolders to categorize documents logically. Examples include:
    * `technical-decisions`: Records of architectural choices and design rationale.
    * `onboarding`:  Step-by-step guides for new developers to get up to speed.
    * `processes`:  Outlines of development workflows, testing practices, code review guidelines, etc.
* **Clear Navigation:**  Include a main `README.md` with a brief description of the `docs` folder and a table of contents linking to key subfolders and documents.
* **Regular Updates:**  Encourage team members to contribute to and maintain documentation, ensuring it remains accurate and relevant.

**Example Structure:**

```
docs/     
  README.md
  technical-decisions/
     architecture.md
     database-choices.md
  onboarding/
     developer-setup.md
     project-overview.md
  processes/
      code-review-guidelines.md
      testing-workflows.md
  ...
```

## Local Postgres Quickstart

Need PostgreSQL for local development? Follow these steps to make the backend happy with the new `DATABASE_URL` setting:

1. Install Postgres (macOS example): `brew install postgresql@16 && brew services start postgresql@16`.
2. Create a database: `createdb boilerplate_dev` and optionally a dedicated user: `createuser --pwprompt boilerplate_app`.
3. Drop the resulting connection string into your `.env.development` file:
   ```
   DATABASE_URL="postgresql://boilerplate_app:<password>@localhost:5432/boilerplate_dev"
   ```
4. Prefer a disposable instance? Run `npx prisma dev`, press `t` to surface the TCP URL, and reuse that string during development.

Document any tweaks (ports, SSL, pooling) here so the next engineer can bootstrap in minutes.

## Data Migration Notes

See `docs/migration-guide.md` for the step-by-step helper that exports Mongo collections and re-imports them through Prisma using the `scripts/dev/migrate-mongo-to-postgres.ts` utility.
