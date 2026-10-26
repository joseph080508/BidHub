# BidHub

Plataforma de subastas construida con Next.js (App Router) y TypeScript.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Prisma (PostgreSQL)
- ESLint

## Estructura

```
bidhub/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   └── images/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   ├── (private)/
│   │   ├── (admin)/
│   │   ├── api/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   ├── features/
│   ├── lib/
│   └── proxy.ts
├── .env.example
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run start    # servidor de producción
npm run lint     # lint
```

## Variables de entorno

Copia `.env.example` a `.env` y completa `DATABASE_URL`.

## Docker

```bash
docker build -t bidhub .
docker run -p 3000:3000 bidhub
```
