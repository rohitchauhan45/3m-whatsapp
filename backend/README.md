# Node.js Express Boilerplate with TypeScript & Prisma

A production-ready, well-structured backend boilerplate built with Node.js, Express, TypeScript, and Prisma ORM. This project emphasizes best practices in folder architecture, security, and scalability.

## **Features**

- 🚀 **Express.js** - Fast, unopinionated web framework
- 📘 **TypeScript** - Type safety and better developer experience
- 🗄️ **Prisma ORM** - Modern database toolkit for PostgreSQL
- 🔐 **JWT Authentication** - Secure user authentication with email verification
- ✅ **Request Validation** - Zod schema validation
- 📝 **Logging** - Winston logger with daily rotate files
- 🧪 **Testing** - Jest setup for unit and integration tests
- 💳 **Payment Integration** - Stripe payment support
- 🎨 **Code Quality** - ESLint + Prettier for consistent code style

---

## **Prerequisites**

Before you begin, ensure you have the following installed:

- **Node.js**: v20.19+, v22.12+, or v24.0+ (Required for Prisma)
  ```bash
  node --version
  ```

- **pnpm**: v10.0+ (Recommended package manager)
  ```bash
  npm install -g pnpm
  ```

- **PostgreSQL**: v14+ (Database)
  - macOS: Install via Homebrew (see Database Setup section)
  - Windows: [Download PostgreSQL](https://www.postgresql.org/download/)
  - Linux: `sudo apt install postgresql postgresql-contrib`

---

## **Quick Start Guide**

### **1. Clone the Repository**

```bash
git clone <your-repository-url>
cd backend
```

### **2. Install Dependencies**

Use `pnpm` for faster and more reliable installations:

```bash
pnpm install
```

> **Note**: If you're using `npm`, some packages might have engine compatibility warnings. Using `pnpm` is recommended.

### **3. Environment Configuration**

Create a `.env.development` file in the root directory:

```bash
touch .env.development
```

Add the following environment variables:

```env
# Environment
NODE_ENV=development

# Server Configuration
PORT=4001

# Database Configuration
DATABASE_URL="postgresql://postgres@localhost:5432/360?schema=public"

# JWT Secret (Generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Rate Limiting
RATE=100

# Email Configuration (Optional - for email verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Frontend URL (for email verification links)
AUTH_SERVER_URL=http://localhost:3000
```

> **Security Note**: Never commit `.env` files to version control. Make sure `.env*` is in your `.gitignore`.

---

## **Database Setup**

### **Step 1: Install PostgreSQL**

#### **macOS (using Homebrew)**

```bash
# Install PostgreSQL 14
brew install postgresql@14

# Check installation
psql --version
```

#### **Linux (Ubuntu/Debian)**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### **Step 2: Start PostgreSQL Service**

#### **macOS**

```bash
brew services start postgresql@14
```

#### **Linux**

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Start on boot
```

### **Step 3: Create PostgreSQL User**

If the default `postgres` user doesn't exist, create it:

```bash
createuser -s postgres
```

### **Step 4: Verify Database Connection**

Test your PostgreSQL connection:

```bash
psql postgres
```

You should see the PostgreSQL prompt. Type `\q` to exit.

---

## **Prisma Setup**

### **Step 1: Run Database Migrations**

This command will:
- Create the database if it doesn't exist
- Apply all migrations to set up your database schema

```bash
pnpm prisma migrate dev
```

Expected output:
```
PostgreSQL database 360 created at localhost:5432
Applying migration `20251126130500_init`
Applying migration `20251203071747_add_user_table`
Applying migration `20251205052803_add_payment_table`
Applying migration `20251207173140_add_email_verify`
Your database is now in sync with your schema.
```

### **Step 2: Generate Prisma Client**

Generate the Prisma Client to interact with your database:

```bash
pnpm prisma generate
```

Expected output:
```
✔ Generated Prisma Client (v7.0.1)
```

### **Step 3: Open Prisma Studio (Optional)**

View and manage your database with a visual interface:

```bash
pnpm prisma:studio
```

This opens Prisma Studio at `http://localhost:5555`

---

## **Running the Application**

### **Development Mode**

Start the development server with auto-reload:

```bash
pnpm dev
```

Expected output:
```
info: Server is running on :::4001
info: Connected to PostgreSQL
Done
```

The server will start on the port specified in your `.env.development` file (default: 4001).

### **Production Mode**

Build and run the production version:

```bash
# Build TypeScript to JavaScript
pnpm build

# Start production server
pnpm start
```

---

## **Available Scripts**

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build TypeScript to JavaScript |
| `pnpm start` | Start production server |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Check code quality with ESLint |
| `pnpm lint:fix` | Fix ESLint errors automatically |
| `pnpm format` | Format code with Prettier |
| `pnpm prisma:migrate` | Run database migrations |
| `pnpm prisma:generate` | Generate Prisma Client |
| `pnpm prisma:studio` | Open Prisma Studio |
| `pnpm create-domain` | Generate a new domain module |
| `pnpm seed:users` | Seed database with sample users |

---

## **Project Structure**

```
backend/
├── prisma/                    # Database schema and migrations
│   ├── schema.prisma         # Prisma schema definition
│   └── migrations/           # Database migration files
├── src/
│   ├── domains/              # Feature-based modules (auth, user, payment)
│   │   ├── auth/            # Authentication logic
│   │   ├── user/            # User management
│   │   └── payment/         # Payment processing
│   ├── configs/              # Configuration management
│   ├── middlewares/          # Express middlewares
│   │   ├── jwt/             # JWT authentication
│   │   ├── error-handling/  # Global error handler
│   │   └── request-validate/# Request validation
│   ├── libraries/            # Reusable utilities
│   │   ├── db/              # Database connection
│   │   ├── log/             # Winston logger
│   │   └── util/            # Utility functions
│   ├── app.ts               # Express app setup
│   ├── server.ts            # Server initialization
│   └── start.ts             # Application entry point
├── test/                     # Test files
├── docker/                   # Docker configuration
├── docs/                     # Documentation
└── scripts/                  # Utility scripts
```

---

## **API Endpoints**

### **Authentication**

- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/verify-email` - Request email verification
- `GET /api/v1/auth/verify-email?token=xxx` - Verify email with token

### **User Management**

- `GET /api/v1/users/profile` - Get user profile (Protected)
- `PUT /api/v1/users/profile` - Update user profile (Protected)

### **Payment**

- `POST /api/v1/payments/create` - Create payment intent (Protected)

---

## **Database Schema**

### **User Model**
```prisma
model User {
  id             String   @id @default(cuid())
  username       String   @unique
  email          String   @unique
  password       String
  name           String?
  emailVerified  Boolean  @default(false)
  role           String   @default("user")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### **Payment Model**
```prisma
model Payment {
  id            String   @id @default(cuid())
  userId        String   @unique
  tier          String
  amount        BigInt
  currency      String
  paymentStatus String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

## **Troubleshooting**

### **Issue: "Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+"**

**Solution**: Upgrade Node.js to a supported version:
```bash
# Using nvm (Node Version Manager)
nvm install 22
nvm use 22
```

### **Issue: "Can't reach database server at localhost:5432"**

**Solution**: Ensure PostgreSQL is running:
```bash
# macOS
brew services start postgresql@14

# Linux
sudo systemctl start postgresql
```

### **Issue: "Environment file not found"**

**Solution**: Create the required environment file:
```bash
# For development
touch .env.development

# Add required environment variables (see Environment Configuration section)
```

### **Issue: "Cannot find module '.prisma/client/default'"**

**Solution**: Generate Prisma Client:
```bash
pnpm prisma generate
```

### **Issue: "listen EADDRINUSE: address already in use"**

**Solution**: Port is already in use. Either:
1. Kill the process using the port:
   ```bash
   # Find process
   lsof -i :4001
   
   # Kill process
   kill -9 <PID>
   ```
2. Change the `PORT` in your `.env.development` file

---

## **Testing**

Run the test suite:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

---

## **Contributing**

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

## **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## **Community Contributions**

This boilerplate aims to be a collaborative resource. Feel free to:
- 🐛 Report bugs
- 💡 Suggest new features
- 🔧 Submit pull requests
- 📖 Improve documentation

---

## **Additional Resources**

- [Express.js Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
