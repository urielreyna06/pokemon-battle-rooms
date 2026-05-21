# ⚔️ Pokémon Battle Rooms

Aplicación web full-stack de batallas Pokémon 1v1 en tiempo real mediante salas con código compartido.  
Proyecto académico — UTP FISC.

---

## Stack Tecnológico

| Capa         | Tecnología                          |
|--------------|-------------------------------------|
| Runtime      | [Bun](https://bun.sh) 1.1+          |
| Frontend     | [TanStack Start](https://tanstack.com/start) + React 18 |
| Backend API  | [Hono](https://hono.dev) 4.x        |
| Base de datos| MongoDB 7                           |
| Auth         | [Clerk](https://clerk.com)          |
| Pagos        | [Stripe](https://stripe.com)        |
| Contenedores | Docker + Docker Compose             |

---

## Estructura del proyecto

```
pokemon-battle-rooms/
├── docker-compose.yml
├── .env.example
├── scripts/
│   └── import-pokemon.ts       ← Importación única desde PokeAPI
├── packages/
│   └── shared/
│       └── types.ts            ← Tipos TypeScript compartidos
└── apps/
    ├── api/                    ← Backend Hono (puerto 3001)
    │   └── src/
    │       ├── server.ts
    │       ├── db.ts
    │       ├── routes/         ← rooms, battle, pokemon
    │       └── engine/
    │           └── battleEngine.ts  ← Motor de batalla completo
    └── web/                    ← Frontend TanStack Start (puerto 3000)
        └── app/
            ├── routes/         ← index, lobby, team, battle
            └── components/     ← HPBar, PokemonSprite, MoveButton, BattleLog
```

---

## Configuración de Auth y Pagos

### Clerk (autenticación)

1. Crear cuenta en [clerk.com](https://dashboard.clerk.com) y crear una nueva aplicación.
2. Copiar las claves en `.env`:
   ```
   CLERK_SECRET_KEY=sk_test_...
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```
3. En el dashboard de Clerk, ir a **Webhooks → Add Endpoint**:
   - URL: `https://tu-dominio.com/webhooks/clerk`
   - Eventos: `user.created`, `user.updated`, `user.deleted`
4. Copiar el **Signing Secret** del webhook en `.env`:
   ```
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

### Stripe (suscripciones — $5/mes para Shiny Pokémon)

1. Crear cuenta en [stripe.com](https://dashboard.stripe.com) en **modo test**.
2. Ir a **Products → Add Product**:
   - Nombre: `Shiny Hunter`
   - Precio: `$5.00 / month` (recurrente)
3. Copiar las claves y el Price ID en `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_PRICE_ID=price_...
   ```
4. Para desarrollo local, reenviar webhooks con la [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3001/webhooks/stripe
   ```
   Copiar el webhook signing secret en `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
5. Para producción, crear un webhook en el dashboard de Stripe:
   - URL: `https://tu-dominio.com/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Shiny Pokémon

Los suscriptores activos (`subscriptionStatus: active`) obtienen:
- Sprites shiny en el Pokédex (`/pokemon`)
- **5% de probabilidad** de que un Pokémon entre en batalla como shiny (visual únicamente, sin cambio de stats)

---

## Ejecución con Docker (recomendado)

### 1. Levantar los servicios

```bash
docker compose up --build
```

Esto levanta tres servicios: `mongo` (MongoDB 7), `api` (Hono en :3001) y `web` (frontend en :3000).

### 2. Importar datos de PokeAPI → MongoDB

La importación **debe ejecutarse una única vez** (o cuando se quiera refrescar los datos). Tardará varios minutos porque hace ~300+ peticiones a PokeAPI con delays para evitar rate limiting.

```bash
docker compose run --rm importer
```

O sin Docker, con Bun instalado localmente:

```bash
MONGO_URL=mongodb://localhost:27017/pokemon_battle bun run scripts/import-pokemon.ts
```

### 3. Abrir la aplicación

- Frontend: http://localhost:3000
- API health check: http://localhost:3001/health

---

## Ejecución sin Docker (desarrollo local)

Requisitos: Bun 1.1+ y MongoDB corriendo en localhost:27017.

```bash
# Instalar dependencias
bun install

# Importar datos (una sola vez)
MONGO_URL=mongodb://localhost:27017/pokemon_battle bun run scripts/import-pokemon.ts

# Arrancar API (terminal 1)
bun run dev:api

# Arrancar Web (terminal 2)
bun run dev:web
```

---

## Flujo de juego

1. **Jugador A** abre http://localhost:3000, ingresa su nombre y crea una sala → recibe un código de 6 caracteres.
2. **Jugador B** abre la misma URL en otro navegador/pestaña de incógnito, ingresa su nombre y el código de sala.
3. Ambos están en el **Lobby** — cuando los dos presionan "Mark as Ready", pasan a la selección de equipo.
4. Cada uno selecciona hasta **6 Pokémon** del catálogo y confirma.
5. La **batalla** comienza: por turnos, cada jugador elige usar un movimiento o cambiar su Pokémon activo.
6. El servidor resuelve ambas acciones y actualiza el estado. La UI hace polling cada 1.5 segundos.
7. Cuando todos los Pokémon de un jugador llegan a 0 HP, ese jugador pierde.

---

## Reglas implementadas

### Fórmula de daño

```
baseDamage = floor(floor(floor((2*50)/5+2) * power * atkStat / defStat) / 50) + 2
randomFactor = random(85..100) / 100
stab = 1.5 si el tipo del movimiento coincide con uno de los tipos del atacante
typeMultiplier = producto de efectividades por cada tipo del defensor (x0, x0.5, x1, x2)
critical = 1.5 si random < 1/24
burnModifier = 0.5 si atacante está quemado Y movimiento es físico
finalDamage = max(1, floor(baseDamage * randomFactor * stab * typeMultiplier * critical * burnModifier))
             -- excepto si typeMultiplier = 0, entonces damage = 0
```

Stats de batalla calculadas con nivel fijo 50 e IVs aleatorios (0–31):

```
HP  = floor(((2 * baseHp + iv) * 50) / 100) + 50 + 10
Otro = floor(((2 * base + iv) * 50) / 100) + 5
```

### Estados temporales

Los estados duran **exactamente 3 turnos** del Pokémon afectado y se **eliminan al cambiar de Pokémon**:

| Estado       | Efecto                                             |
|--------------|----------------------------------------------------|
| `burn`       | -5% HP máx por turno; reduce daño físico a la mitad |
| `poison`     | -5% HP máx por turno                               |
| `paralysis`  | Speed ÷ 2; 25% de probabilidad de no poder actuar  |
| `attackDown` | Baja el stage de ataque 1 nivel por turno          |
| `defenseDown`| Baja el stage de defensa 1 nivel por turno         |
| `speedDown`  | Baja el stage de velocidad 1 nivel por turno       |

### Orden de acciones

MVP: **coin flip** (aleatorio). El servidor decide el orden antes de resolver ambas acciones.

### Efectividad por tipo

Las relaciones de daño se importan desde PokeAPI (`/api/v2/type/{id}/`) y se guardan en MongoDB. **No están hardcodeadas**. El motor las consulta en tiempo real desde la colección `type_relations`.

---

## Fuente de datos

- **PokeAPI**: https://pokeapi.co/api/v2/
  - `GET /pokemon?limit=300&offset=0` — lista paginada
  - `GET /pokemon/{name}` — detalle (stats, tipos, sprites, movimientos)
  - `GET /move/{name}` — detalle de cada movimiento
  - `GET /type/{id}/` — relaciones de daño por tipo

Los datos se importan **una sola vez** y se persisten en MongoDB. Durante las batallas, la app **nunca llama a PokeAPI** — lee exclusivamente desde MongoDB.

### Sprite style

Se usa consistentemente `sprites.other.showdown.front_default` (sprites animados de Showdown) con fallback a `sprites.front_default`. Nunca se mezclan estilos 2D con 3D.

---

## Limitaciones conocidas

- **300 Pokémon importados** (primera generación + parte de segunda). Los Pokémon con menos de 4 movimientos dañinos válidos en PokeAPI se excluyen automáticamente del catálogo.
- **Autenticación requerida** — todos los endpoints de juego requieren sesión Clerk activa.
- **Orden de turno por coin flip (MVP)** — no implementa prioridad de movimiento + velocidad.
- **Sin persistencia entre sesiones** — cerrar el navegador pierde el contexto de sala; la batalla sigue activa en el servidor.
- **Estados secundarios** — los efectos secundarios de movimientos tienen 30% de probabilidad de aplicarse. No todos los movimientos de PokeAPI tienen efectos correctamente parseados.
- **Sin límite de tiempo por turno** — un jugador puede no actuar indefinidamente.

---

## API Endpoints

| Método | Ruta                       | Descripción                                       |
|--------|----------------------------|---------------------------------------------------|
| POST   | `/rooms`                   | Crea sala, devuelve código de 6 chars             |
| POST   | `/rooms/:code/join`        | Jugador se une a sala (`{ playerName }`)          |
| POST   | `/rooms/:code/team`        | Envía selección de equipo (`{ playerId, team[] }`)|
| POST   | `/rooms/:code/ready`       | Marca jugador como listo; inicia batalla si ambos |
| GET    | `/rooms/:code`             | Estado actual de sala + batalla (para polling)    |
| GET    | `/pokemon`                 | Catálogo paginado (`?limit=20&offset=0`)          |
| POST   | `/battle/:roomCode/action` | Envía acción (`{ playerId, action }`)             |
| GET    | `/battle/:roomCode`        | Estado actual de la batalla                       |
| GET    | `/health`                  | Health check del servidor                         |
| GET    | `/users/me`                | Perfil del usuario autenticado                    |
| POST   | `/stripe/create-checkout-session` | Crea sesión de pago Stripe ($5/mes)        |
| GET    | `/stripe/subscription-status`    | Estado de suscripción del usuario actual    |
| POST   | `/webhooks/clerk`          | Sincroniza usuarios Clerk → MongoDB               |
| POST   | `/webhooks/stripe`         | Actualiza `shinyUnlocked` por eventos Stripe      |

> **Nota:** Todos los endpoints excepto `/webhooks/*` y `/health` requieren `Authorization: Bearer <clerk-token>`.

---

## Validación post-import

```bash
# Verificar que hay ≥300 Pokémon
docker compose exec mongo mongosh pokemon_battle --eval "db.pokemon.countDocuments()"

# Verificar que tienen exactamente 4 movimientos
docker compose exec mongo mongosh pokemon_battle \
  --eval "db.pokemon.findOne({}, {name:1, moveIds:1})"

# Verificar relaciones de tipo importadas
docker compose exec mongo mongosh pokemon_battle \
  --eval "db.type_relations.countDocuments()"
# Expected: 18
```
