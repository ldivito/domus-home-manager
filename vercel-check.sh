#!/bin/bash

set -e

echo "🔍 Verificación estricta tipo Vercel..."
echo ""

# 1. TypeScript strict check
echo "1️⃣ TypeScript strict check..."
npx tsc --noEmit --strict

echo ""

# 2. ESLint con reglas estrictas
echo "2️⃣ ESLint check..."
npx eslint . --ext .ts,.tsx --max-warnings 0

echo ""

# 3. Next.js build
echo "3️⃣ Next.js build check..."
npm run build

echo ""
echo "✅ Todas las verificaciones pasaron"