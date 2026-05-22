# Proyecto individual: Pokémon Battle Rooms

Enunciado funcional, requisitos técnicos y extensiones

---

## Resumen de asignación

| Asignación | Pokémon Battle Rooms |
|---|---|
| Curso | Desarrollo de Software |
| Modalidad | Individual |
| Duración | 1 semana |
| Entrega | Demo corta en clase |
| Docente | Erick Vicente Agrazal Lopez |

---

## 1. Resumen para Microsoft Teams

Desarrollar una aplicación web de batallas Pokémon 1P vs 1P mediante salas con código, usando datos importados desde PokéAPI y persistidos en MongoDB. El sistema debe permitir crear partidas, unir dos jugadores, seleccionar equipos, resolver turnos de combate y aplicar reglas básicas de daño, tipos, estados y victoria.

### Instrucciones principales

- El proyecto es individual y debe completarse en 1 semana.
- Usa el stack obligatorio: TanStack Start, Bun, Hono, MongoDB y Docker / Docker Compose.
- Carga al menos 300 Pokémon desde PokéAPI. La data no debe estar hardcodeada; debe importarse desde PokéAPI y guardarse en MongoDB.
- Cada Pokémon en batalla debe tener exactamente 4 movimientos válidos obtenidos desde PokéAPI.
- Implementa salas: un jugador crea la sala, el sistema genera un código y el segundo jugador se une usando ese código.
- La batalla debe ser 1P vs 1P. Cada jugador debe tener equipo de hasta 6 Pokémon y un Pokémon activo en combate.
- El backend debe validar acciones y resolver el turno. El frontend solo debe enviar decisiones y mostrar el estado actualizado.
- Aplica daño tomando en cuenta poder del movimiento, tipo de movimiento, stats, STAB, efectividad por tipo, factor aleatorio y golpe crítico.
- Las vulnerabilidades, resistencias e inmunidades por tipo deben obtenerse desde PokéAPI.
- Si un movimiento aplica un estado, ese estado dura 3 turnos. Si el Pokémon cambia o se retira, el estado se elimina.
- Usa sprites consistentes. No mezcles estilos visuales incompatibles (ej. sprites 2D con renders 3D).
- Incluye animaciones básicas para ataques, daño recibido, cambios de Pokémon, barras de vida o debilitamiento.

---

## 2. Enunciado del proyecto

### Objetivo general

Construir una aplicación full-stack que cargue datos reales desde PokéAPI, permita crear salas de batalla, resuelva turnos de combate desde el servidor y muestre una experiencia visual funcional con sprites y animaciones básicas.

---

## 3. Flujo del sistema

1. Usuario crea o se une a una sala con código.
2. Cada jugador selecciona su equipo de hasta 6 Pokémon.
3. Ambos marcan "listo" — el servidor inicializa la batalla.
4. Cada turno: ambos jugadores envían su acción (mover o cambiar Pokémon).
5. El servidor valida, resuelve el turno y actualiza el estado.
6. El frontend recibe el estado actualizado y muestra el resultado.
7. La batalla termina cuando todos los Pokémon de un jugador se debilitan.

---

## 4. Reglas de combate

- Cada turno los dos jugadores envían una acción simultáneamente.
- Las acciones válidas son: usar un movimiento o cambiar de Pokémon activo.
- Un Pokémon debilitado (HP = 0) no puede seguir en combate.
- El jugador que se queda sin Pokémon disponibles pierde.
- El backend es la fuente de verdad; el frontend solo muestra el estado.

---

## 5. Fórmulas sugeridas para el motor de batalla

### Fórmula de daño

```txt
baseDamage = floor(
  floor(
    floor((2 * level) / 5 + 2) * movePower * attackStat / defenseStat
  ) / 50
) + 2

finalDamage = floor(baseDamage * modifier)
modifier = randomFactor * stab * typeMultiplier * critical * burnModifier * fieldModifier
```

| Concepto | Fórmula sugerida |
|---|---|
| Random factor | randomInt(85, 100) / 100 |
| STAB | 1.5 si el tipo del movimiento coincide con un tipo del atacante; si no, 1 |
| Tipo | Multiplicar x2, x0.5, x0 o x1 por cada tipo del defensor |
| Crítico | 1.5 si random() < 1/24; si no, 1 |
| Quemadura | 0.5 si atacante está quemado y usa movimiento físico; si no, 1 |
| Campo | 1 por defecto; opcionalmente lluvia/sol pueden modificar Agua/Fuego |

Nivel fijo en 50 para simplificación.

---

## 6. Fórmulas complementarias

### Ataque y defensa según categoría

```txt
if (move.damageClass === 'physical') {
  attackStat = attacker.attack
  defenseStat = defender.defense
}
if (move.damageClass === 'special') {
  attackStat = attacker.specialAttack
  defenseStat = defender.specialDefense
}
if (move.damageClass === 'status') damage = 0
```

### Estados pasivos

```txt
burnDamage = floor(target.maxHp * 0.05)
poisonDamage = floor(target.maxHp * 0.05)
status.remainingTurns -= 1
if (status.remainingTurns <= 0) removeStatus(target)
```

- Parálisis puede reducir velocidad a la mitad. Opcionalmente, 25% de probabilidad de no moverse.
- Los estados duran 3 turnos y se eliminan si el Pokémon cambia o se retira.

---

## 7. Requisitos técnicos

### Base de datos

- Pokémon importados desde PokéAPI.
- Movimientos importados.
- Tipos y relaciones de daño.
- Salas.
- Partidas y estado actual de batalla.
- Log de batalla.

| Modelo | Campos sugeridos |
|---|---|
| Pokemon | id, pokedexId, name, types, baseStats, spriteUrl, moveIds |
| Move | id, name, type, power, accuracy, priority, damageClass, effect |
| Room | code, status, players, createdAt |
| Battle | roomCode, turn, status, players, activePokemonId, selectedAction, battleLog, winnerPlayerId |

---

## 8. Opcionales / bonus

- Baneo de 6 Pokémon antes de iniciar la partida.
- Variación de estadísticas por partida mediante IV o multiplicador aleatorio.
- Orden de turno usando prioridad del movimiento y velocidad efectiva.
- Sistema de objetos para curar o remover estados.
- Sistema de campos o clima: lluvia, sol, tormenta de arena, terreno eléctrico.
- Temporizador por turno.
- Historial o replay de partidas.
- Reconexión a sala si se refresca el navegador.
- Modo espectador.
- Filtros por nombre o tipo.

---

## 9. Fuentes consultadas

- PokéAPI Docs v2: https://pokeapi.co/docs/v2
- TanStack: https://tanstack.com/
- Hono: https://hono.dev/
- Hono + Bun: https://hono.dev/docs/getting-started/bun

---

## 10. Notas de implementación

- No almacenar la contraseña de usuarios. Si se implementa auth, usar OAuth o servicios externos.
- El motor de batalla debe vivir completamente en backend.
- Los tipos de daño deben consultarse desde PokéAPI, no hardcodearse.
- Usar sprites de PokéAPI de forma consistente en toda la interfaz.

---

## 11. Rúbrica base — 100 puntos + bonus opcional

| Criterio | Puntos |
|---|---:|
| Carga de datos desde PokéAPI y persistencia en MongoDB | 15 |
| Catálogo de al menos 300 Pokémon con sprites, tipos, stats y movimientos | 15 |
| Sistema de salas 1 vs 1 con código | 15 |
| Motor de batalla: turnos, daño, estados, cambios y victoria | 25 |
| Uso correcto de vulnerabilidades por tipo | 10 |
| UI, sprites consistentes y animaciones básicas | 10 |
| Docker, README y demo funcional | 10 |
| **Total base** | **100** |

Se pueden otorgar hasta 10 puntos extra por opcionales bien implementados, especialmente mecánicas de prioridad y velocidad, objetos, campos/clima, baneo, replay o reconexión. El bonus no sustituye requisitos obligatorios incompletos.

---

## 12. Stack obligatorio

| Capa | Tecnología |
|---|---|
| Runtime | Bun 1.1 |
| Backend framework | Hono 4.x |
| Base de datos | MongoDB 7 |
| Frontend | React 18 + TanStack Router + Vite |
| Contenedores | Docker / Docker Compose |
| Testing | Vitest v2 |

---

## 13. Extensión funcional propuesta

Las siguientes secciones amplían el documento original sin sustituir sus requisitos base. Se presentan como una extensión funcional y técnica coherente con el alcance original del proyecto: batallas Pokémon resueltas desde backend, uso de datos persistidos en MongoDB, interfaz web con salas y reglas verificables. Estas ampliaciones deben entenderse como una capa adicional de diseño sobre la base ya definida en el enunciado.

---

## 14. Modo Jugador vs PC usando algoritmo A*

### Regla de operación del modo Jugador vs PC

- El Jugador 1 es un usuario humano.
- El Jugador 2 es una entidad controlada por el servidor.
- La partida mantiene estructura de equipo de hasta 6 Pokémon.
- Cada Pokémon en batalla mantiene exactamente 4 movimientos válidos, igual que en el modo original.
- El flujo de daño, cambios, estados y log reutiliza el mismo motor del modo sala.
- La diferencia principal es cómo se genera la acción del segundo participante.

### Función de costo y heurística

Para que A* sea útil, debe definirse una medida de calidad del estado.

#### Costo acumulado g(n)

Puede representar el costo de las decisiones tomadas hasta el nodo actual. Algunas interpretaciones posibles:

- HP perdido por la PC.
- Cantidad de turnos consumidos.
- Penalización por entrar en desventaja de tipo.
- Costo por gastar cambios de Pokémon en situaciones poco favorables.

#### Heurística h(n)

La heurística estima qué tan favorable será continuar desde el estado actual. Debe ser rápida de calcular y útil para priorizar nodos. Puede incluir:

- HP restante del rival.
- Posibilidad de KO en el próximo turno.
- Ventaja de tipo de la PC.
- Riesgo de recibir KO.
- Presencia de estados pasivos o debilitantes.
- Valor táctico de preservar un Pokémon con ventaja.

#### Evaluación total

```txt
f(n) = g(n) + h(n)
```

Si el diseño decide trabajar con utilidad en vez de costo, puede usarse una versión equivalente siempre que el criterio de orden sea consistente en toda la búsqueda.

---

## 15. Login obligatorio con Clerk

Se agrega autenticación obligatoria con Clerk como requisito del sistema extendido. A diferencia del documento original, donde no se requería login para el modo de salas, esta extensión introduce una nueva política global de acceso: ningún usuario puede interactuar con el aplicativo sin haber iniciado sesión.

### Regla global de acceso

- Usuario no logueado: no puede entrar ni interactuar con ninguna vista funcional.
- Usuario logueado sin suscripción: puede usar todo el modo gratuito.
- Usuario logueado con suscripción activa: puede usar modo gratuito y funciones shiny.

---

## 16. Pasarela de pago con Stripe SDK

Se agrega integración con Stripe SDK para manejar una suscripción mensual de **4.99 USD**. Esta suscripción desbloquea contenido especial llamado **shinys**. Esta capa comercial debe ser coherente con el resto del documento: no altera la lógica base de combate, sino que controla acceso a contenido cosmético o especial dentro de la aplicación.

### Flujo funcional sugerido

1. El usuario autenticado presiona la opción de suscribirse.
2. El frontend solicita al backend una sesión de checkout.
3. El backend crea la sesión de Stripe con el precio mensual de 4.99 USD.
4. El usuario completa el pago en Stripe.
5. Stripe envía un webhook al backend.
6. El backend actualiza el estado de suscripción del usuario en MongoDB.
7. El frontend consulta o refresca permisos y habilita opciones shiny si corresponde.

### Ejemplo de creación de sesión de checkout

```ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createCheckoutSession(userId: string, email: string) {
  return await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [
      {
        price: process.env.STRIPE_SHINY_MONTHLY_PRICE_ID!,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      plan: 'shiny-monthly',
    },
    success_url: `${process.env.APP_URL}/billing/success`,
    cancel_url: `${process.env.APP_URL}/billing/cancel`,
  })
}
```

### Validación de acceso a shinys

El acceso shiny no debe depender solo de ocultar botones en UI. Debe validarse siempre también en backend.

```ts
type AccessProfile = {
  isAuthenticated: boolean
  hasActiveShinySubscription: boolean
}

function canUseShiny(profile: AccessProfile): boolean {
  return profile.isAuthenticated && profile.hasActiveShinySubscription
}
```
