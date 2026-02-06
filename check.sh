#!/bin/bash

set -e

# Verificar errores de TypeScript
echo "Verificando TypeScript..."
npm run typecheck

echo "TypeScript OK"

exit 0