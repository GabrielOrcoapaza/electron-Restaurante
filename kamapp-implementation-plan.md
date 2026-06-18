# Plan de Implementación — KamApp (Solo Versión Web)

> Sistema de pantalla de cocina para restaurantes, adaptado al proyecto Electron-Restaurante existente (solo soporte para web).  
> Reutiliza el mismo backend GraphQL y WebSocket que la app Android, y reutiliza la arquitectura existente del proyecto.

---

## 1. Visión general

La versión web replica la funcionalidad de la app Android en un navegador, pensada para monitores de cocina o dispositivos móviles. El flujo es idéntico:

```
Login → KitchenScreen (principal)
                          └→ PromotionsScreen (secundaria)
```

El usuario **debe tener rol `COCINERO`** — el backend ya valida esto en la mutation `kitchenLogin`; el frontend solo debe verificar que `user.role === "COCINERO"` antes de dejar pasar.

---

## 2. Stack tecnológico (Solo Web)

| Capa                  | Tecnología                             | Justificación                                                                                |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| UI framework          | **React 18 + TypeScript**              | Componentes reutilizables, tipado fuerte                                                     |
| Build tool            | **Vite**                               | HMR rápido, bundle optimizado                                                                |
| GraphQL client        | **Apollo Client 3**                    | Mismas queries/mutations del Android, ya configurado en el proyecto                          |
| WebSocket             | **WebSocketContext** (existente)       | Ya implementado en el proyecto, reutilizable                                                 |
| Estilos               | **Tailwind CSS v3** + CSS modules      | Estilo existente del proyecto                                                                |
| Estado global         | **React Context API**                  | Reutiliza la arquitectura existente del proyecto (AuthContext, ToastContext, KitchenContext) |
| Notificaciones de voz | **Web Speech API** (`speechSynthesis`) | Equivalente al TTS de Android                                                                |
| Persistencia local    | **localStorage**                       | Persistencia en el navegador                                                                 |
| Notificaciones        | **Web Notifications API**              | Notificaciones en el navegador                                                               |

---

## 3. Estructura del Proyecto Existente (Solo Web)

Reutilizamos la estructura existente del proyecto `electron-Restaurante`:

```
electron-Restaurante/
├── src/
│   ├── context/
│   │   ├── KitchenContext.tsx      # Contexto de cocina (nuevo)
│   │   ├── WebSocketContext.tsx   # Contexto WebSocket (existente)
│   │   ├── AuthContext.tsx      # Contexto de autenticación (existente)
│   │   └── ToastContext.tsx       # Contexto de notificaciones (existente)
│   ├── graphql/
│   │   ├── queries.ts             # Queries (incluyendo GET_PENDING_KITCHEN_ITEMS y KITCHEN_LOGIN)
│   │   └── mutations.ts           # Mutations (incluyendo MARK_ITEM_PREPARED, etc.)
│   ├── modules/
│   │   └── kitchen/
│   │       ├── LoginKitchen.tsx   # Pantalla de login de cocinero (nuevo)
│   │       └── KitchenScreen.tsx # Pantalla principal de cocina (nuevo)
│   ├── home/
│   │   └── landing/
│   │       └── LandingPage.tsx    # Página inicial de web (con botón a login-kitchen, nuevo)
│   ├── App.tsx                   # Router principal (con rutas /login-kitchen y /kitchen, nuevas)
│   └── main.tsx                  # Entry point React (con KitchenProvider, nuevo)
├── package.json
└── ... resto de la estructura existente (ignorar partes de Electron)
```

---

## 4. GraphQL — reutilización exacta

Se copian textualmente las operaciones del Android. No se crean queries nuevas.

### 4.1 Mutation de login

```graphql
mutation KitchenLogin($dni: String!, $password: String!, $deviceId: String!) {
    kitchenLogin(dni: $dni, password: $password, deviceId: $deviceId) {
        success
        message
        token
        user {
            id
            dni
            firstName
            lastName
            role
            fullName
        }
        branch {
            id
            name
            isKitchenDisplay
        }
        displayCategories {
            id
            name
            color
        }
        permissions
    }
}
```

- `deviceId` se genera como UUID v4 y se persiste en `electron-store` (equivale al Android `deviceId`).
- Si `user.role !== "COCINERO"` → mostrar error `"Tu usuario no tiene rol de cocinero"` y no navegar.

### 4.2 Query de items pendientes

```graphql
query PendingKitchenItems($branchId: ID!, $userId: ID!) {
    pendingKitchenItems(branchId: $branchId, userId: $userId) {
        id
        quantity
        notes
        createdAt
        productName
        productId
        operationId
        operation {
            id
            order
            serviceType
            table {
                name
                floor {
                    name
                }
            }
            user {
                firstName
                lastName
            }
        }
        product {
            id
            name
            preparationTime
            subcategory {
                id
                name
                category {
                    id
                    name
                    color
                }
            }
        }
        createdBy {
            firstName
            lastName
        }
        comboComponents {
            id
            productName
            categoryId
            quantity
            isPrepared
            isCanceled
        }
    }
}
```

### 4.3 Mutations de marcado

```graphql
mutation MarkItemPrepared($detailId: ID!, $userId: ID!)
mutation MarkPartialPrepared($detailId: ID!, $userId: ID!, $preparedQuantity: Float!)
mutation MarkOrderPrepared($operationId: ID!, $userId: ID!)
mutation MarkGroupPrepared($detailIds: [ID!]!, $userId: ID!)
```

### 4.4 Query de promociones

```graphql
query GetActivePromotions($branchId: ID!) {
    promotionsByBranch(branchId: $branchId, includeInactive: false) {
        id
        name
        description
        promotionType
        validFrom
        validTo
        discountPercent
        discountAmount
        buyQuantity
        getQuantity
        giftQuantity
        minPurchaseAmount
        appliesTo
        priority
        isActive
        isValidNow
        daysDisplay
        photoUrl
    }
}
```

---

## 5. WebSocket

El servicio replica `KitchenWebSocketService.kt` en TypeScript.

**URL de conexión** (mismo patrón que Android):

```
ws(s)://<servidor>/ws/kitchen/<branchId>/?token=<token>
```

**Tipos de mensaje a manejar:**
| `type` | Acción |
|---|---|
| `connection_established` | Emitir evento `Connected` |
| `kitchen_item_update` | Emitir `ItemUpdate` (un item: ADD / UPDATE / REMOVE) |
| `kitchen_items_batch` | Iterar array `items[]`, emitir un `ItemUpdate` por cada elemento |
| `broadcast_message` | Emitir `Broadcast` con `message` + `sender_name` |

**Reconexión automática** con backoff exponencial (1s → 2s → 4s … 60s máx), idéntico al Android. Se detiene solo si el token está vacío (logout explícito).

```typescript
// kitchenEvents.ts
export type KitchenEvent =
    | { type: "Connected" }
    | { type: "Disconnected"; reason?: string }
    | { type: "ItemUpdate"; event: KitchenItemWsEvent }
    | { type: "Broadcast"; message: string; senderName: string };
```

---

## 6. Pantallas

### 6.1 LoginScreen

**Equivalente Android:** `LoginScreen.kt`

Layout de dos columnas en pantallas anchas (≥ 900 px), columna única en ventanas pequeñas.

**Columna izquierda — Branding:**

- Logo de la app
- Nombre "KamApp" + subtítulo "Sistema de Pantalla de Cocina"
- Badges de características: WebSocket tiempo real, alertas de voz, filtros por categoría, notificaciones

**Columna derecha — Formulario:**

- Campo DNI (numérico, máx 8 dígitos)
- Campo Contraseña (con toggle de visibilidad)
- Banner de error animado (fondo rojo semitransparente + ícono)
- Botón "Ingresar" (spinner mientras carga)
- Muestra el `deviceId` con botón copiar al portapapeles

**Lógica:**

1. Obtener o generar `deviceId` desde `electron-store`
2. Llamar mutation `kitchenLogin`
3. Validar `success === true` AND `user.role === "COCINERO"`
4. Persistir `token`, `user`, `branch`, `displayCategories` en `authStore` y `electron-store`
5. Navegar a `HomeScreen`

---

### 6.2 HomeScreen

**Equivalente Android:** `HomeScreen.kt`

**TopBar:**

- Logo + "KamApp" + nombre de la sucursal
- Avatar con inicial del nombre, nombre completo, rol en español
- Botón logout (ícono, color rojo)

**Contenido (scroll vertical, max-width 900 px):**

1. **Banner de bienvenida** — avatar grande, nombre completo, badge sucursal + rol

2. **Acceso Rápido** — tres tarjetas cuadradas:
    - 🍳 **Cocina** → navega a `KitchenScreen`
    - 🏷️ **Promociones** → navega a `PromotionsScreen`
    - 🍷 **Mozo** → deshabilitado ("Próximamente")

3. **Configuración de Voz:**
    - Toggle TTS on/off
    - Si TTS activado: lista de voces en español disponibles en el sistema (`speechSynthesis.getVoices()` filtradas por `lang.startsWith('es')`)
    - Botón "Probar voz seleccionada"

4. **Pantalla:**
    - Toggle "Mantener pantalla encendida" → en Electron usa `powerSaveBlocker` del proceso principal vía IPC

**BottomBar:**

- Tab "Inicio" seleccionado
- Tab "Ajustes" (deshabilitado por ahora)

---

### 6.3 KitchenScreen

**Equivalente Android:** `KitchenScreen.kt` + `KitchenViewModel.kt`

Es la pantalla central de la aplicación. Permanece activa mientras el cocinero trabaja.

**TopBar:**

- Nombre + rol del usuario
- Indicador de conexión WebSocket (punto verde/rojo + texto)
- Selector de vista: `POR ORDEN` | `POR ÍTEM` | `POR PLATO`
- Botón volver a Home, botón logout

**Barra de filtros (colapsable):**

- Vista `POR ORDEN` → chips de piso/zona con conteo de órdenes
- Vistas `POR ÍTEM` y `POR PLATO` → chips de categoría con conteo de items
- Chip "Todos" siempre presente
- Chip seleccionado resaltado (borde verde + fondo azul)

**Área de contenido:**

- Loading spinner mientras carga la query inicial
- Transición `fade` entre cambios de vista

#### Vista POR ORDEN (`ByOrderView`)

- Agrupa items por `operationId`
- Encabezado de orden: número de orden, mesa, piso, mozo, tiempo transcurrido desde el primer item
- Lista de items de la orden con `ItemCard`
- Botón "Orden lista" → `MarkOrderPrepared` (con diálogo de confirmación)

#### Vista POR ÍTEM (`ByItemView`)

- Lista de items individuales ordenados por `createdAtMillis`
- Cada `ItemCard` con botón de marcar preparado

#### Vista POR PLATO (`ByGroupView`)

- Agrupa items por `productName`
- Muestra cantidad total acumulada
- Botón "Preparar todo" → `MarkGroupPrepared` (con diálogo de confirmación)

#### ItemCard

- Nombre del producto, cantidad, notas, tiempo de preparación estimado
- Badge de categoría con color
- Nombre de mesa y piso
- Contador de tiempo desde creación (actualizado cada segundo)
- Indicadores de estado: cancelado (tachado), parcial (cantidad restante)
- Combo components (lista de sub-ítems si aplica)
- Al marcar preparado → abre `QuantityPickerDialog` si la cantidad > 1

**BottomBar:**

- Nombre de sucursal
- Contadores: items pendientes, órdenes, cantidad total
- Indicador de conexión
- Toggle TTS

**Broadcast Banner:**

- Aparece en la parte superior sobre el contenido
- Fondo naranja, ícono de megáfono, mensaje, botón cerrar
- Auto-desaparece a los 5 segundos

**Lógica de WebSocket (equivalente a `KitchenViewModel`):**

```typescript
// En kitchenStore.ts (Zustand)
const handleItemUpdate = (event: KitchenItemWsEvent) => {
    const { displayCategories } = authStore.getState().session;
    const allowed = new Set(
        displayCategories.map((c) => parseInt(c.id)).filter(Boolean),
    );

    // Filtrar por categorías del cocinero
    if (allowed.size > 0 && event.categoryId && !allowed.has(event.categoryId))
        return;

    switch (event.action.toUpperCase()) {
        case "ADD": // agregar item, evitar duplicados por id
        case "UPDATE": // si remainingQuantity <= 0 → REMOVE; si no, actualizar
        case "REMOVE": // filtrar del array, limpiar filtro de piso si ya no existe
    }
};
```

**TTS (Web Speech API):**

- Equivalente a `TtsManager.kt`
- Anuncia nuevos items según la vista activa
- Para `BY_ORDER`: anuncia "Orden número X" solo una vez por operación, luego cada item
- Normaliza texto: separa letras de números, convierte a minúsculas
- Identifica nombres de mesa cortos (≤ 4 chars) con prefijo "mesa"
- Ignora códigos de tipo de servicio (`RESTAURANT`, `DELIVERY`, etc.) como nombres de piso

---

### 6.4 PromotionsScreen

**Nueva pantalla** — no existe en el Android actual.

**Propósito:** pantalla secundaria para mostrar las promociones activas de la sucursal en un monitor adicional o en modo kiosco.

**Layout:**

- Fondo oscuro (mismo palette que el resto)
- TopBar con botón volver a Home
- Grid de tarjetas de promociones (2-3 columnas según ancho)

**Tarjeta de promoción:**

- Imagen (`photoUrl`) si existe, placeholder si no
- Badge de tipo: `PORCENTAJE`, `MONTO FIJO`, `2x1`, `REGALO`, etc.
- Nombre y descripción
- Vigencia (fechas `validFrom` - `validTo`)
- Días en que aplica (`daysDisplay`)
- Descuento destacado (monto o porcentaje)
- Badge "VÁLIDA HOY" si `isValidNow === true`

**Lógica:**

- Llama `GetActivePromotions` al montar con el `branchId` de la sesión
- Polling automático cada 5 minutos para refrescar sin reiniciar
- Solo muestra promociones donde `isActive === true`

---

## 7. Gestión de estado (Zustand)

### authStore

```typescript
interface AuthState {
    token: string | null;
    user: {
        id: string;
        dni: string;
        firstName: string;
        lastName: string;
        role: string;
        fullName: string;
    } | null;
    branch: { id: string; name: string } | null;
    displayCategories: { id: string; name: string; color: string }[];
    deviceId: string;
    login: (result: KitchenLoginResult) => void;
    logout: () => void;
}
```

### kitchenStore

```typescript
interface KitchenState {
    items: KitchenItem[];
    currentView: "BY_ORDER" | "BY_ITEM" | "BY_GROUP";
    selectedCategoryId: number | null;
    selectedFloorName: string | null;
    isConnected: boolean;
    isLoading: boolean;
    broadcastMessage: string | null;
    confirmDialog: ConfirmDialogData | null;
    qtyPickerDialog: QtyPickerDialogData | null;
    tickSecond: number; // timestamp actualizado cada 1s para timers
    // acciones...
}
```

### settingsStore

```typescript
interface SettingsState {
    ttsEnabled: boolean;
    selectedVoiceName: string | null;
    keepAwake: boolean;
    // acciones...
}
```

---

## 8. Persistencia con electron-store

| Clave               | Contenido                                   | Equivalente Android              |
| ------------------- | ------------------------------------------- | -------------------------------- |
| `deviceId`          | UUID v4 generado en primer arranque         | `AppDataStore.deviceId`          |
| `token`             | JWT de la sesión activa                     | `AppDataStore.token`             |
| `session`           | Objeto `UserSession` serializado            | `AppDataStore.session`           |
| `currentView`       | `'BY_ORDER'` \| `'BY_ITEM'` \| `'BY_GROUP'` | `AppDataStore.currentView`       |
| `ttsEnabled`        | boolean                                     | `AppDataStore.ttsEnabled`        |
| `selectedVoiceName` | string                                      | `AppDataStore.selectedVoiceName` |
| `keepAwake`         | boolean                                     | —                                |

Al arrancar la app, se restaura la sesión desde `electron-store`. Si el token existe, se navega directamente a `HomeScreen` sin pasar por `LoginScreen`.

---

## 9. Configuración de Apollo Client

```typescript
// apolloClient.ts
const authLink = new ApolloLink((operation, forward) => {
    const token = authStore.getState().token;
    if (token) {
        operation.setContext({
            headers: { Authorization: `Bearer ${token}` },
        });
    }
    return forward(operation);
});

const httpLink = new HttpLink({ uri: `${serverUrl}/graphql/` });

export const apolloClient = new ApolloClient({
    link: from([authLink, httpLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
        watchQuery: { fetchPolicy: "network-only" },
        query: { fetchPolicy: "network-only" },
    },
});
```

La URL del servidor se configura en la pantalla de login o en un archivo `.env` con un valor por defecto.

---

## 12. Theming — paleta de colores

Misma identidad visual que el Android. Variables CSS para Tailwind:

```typescript
// tailwind.config.ts
colors: {
  'dark-navy':   '#060E1F',
  'navy-blue':   '#0D2137',
  'navy-medium': '#1A2E45',
  'light-navy':  '#1E3A5F',
  'card-white':  '#FFFFFF',
  'green-success': '#4CAF50',
  'timer-red':   '#F44336',
  'timer-orange': '#FF9800',
  'orange-badge': '#FF6F00',
  'text-on-dark': '#E8EAF0',
  'text-on-dark-sec': '#8A9BBE',
  'chip-border': '#2A3F5F',
  'chip-selected': '#4CAF50',
}
```

---

## 13. Fases de desarrollo (Solo Web)

### Fase 1 — Esqueleto y autenticación (Completada!)

- [x] **Adaptar al proyecto existente** (no hay que crear scaffold nuevo)
- [x] **Agregar queries y mutations GraphQL** (GET_PENDING_KITCHEN_ITEMS, KITCHEN_LOGIN, MARK_ITEM_PREPARED, etc.)
- [x] **Crear KitchenContext.tsx** (contexto global para cocina, integración con Apollo Client y WebSocketContext)
- [x] **Crear LoginKitchen.tsx** (pantalla de login de cocinero, solo web)
- [x] **Agregar rutas en App.tsx** (/login-kitchen y /kitchen, con ProtectedKitchenRoute)
- [x] **Integrar KitchenProvider en main.tsx**
- [x] **Agregar botón de acceso en LandingPage.tsx** (web)
- [x] **Persistencia de sesión en localStorage**

### Fase 2 — WebSocket y estado de cocina (Completada!)

- [x] **Integrar WebSocketContext en KitchenContext** (actualización en tiempo real de items)
- [x] **Query inicial GET_PENDING_KITCHEN_ITEMS**
- [x] **Filtrado por displayCategories del cocinero** (Completada!)

### Fase 3 — KitchenScreen y vistas (Completada!)

- [x] **Crear KitchenScreen.tsx** (pantalla principal de cocina)
- [x] **ByOrderView** y **ByItemView** (integradas en KitchenScreen)
- [x] **ByGroupView** (Completada!)
- [x] **ItemCard completo** con timer, badges, combo components (Completada!)
- [x] **QuantityPickerDialog y ConfirmDialog** (Completada!)
- [x] **Filtros de categoría y piso** (Completada!)
- [x] **TopBar y BottomBar de cocina** (Completada!)
- [x] **BroadcastBanner** (Completada!)
- [x] **Mutations de marcado** (integradas en KitchenContext)

### Fase 4 — TTS y notificaciones web (Completada!)

- [x] **useTts hook con Web Speech API** (Completada!)
- [x] **Notificaciones Web** (Completada!)

### Fase 5 — PromotionsScreen (Completada!)

- [x] **PromotionsScreen** (pantalla de promociones activas, completada)
- [x] **Query GetActivePromotions** (ya existía, completada)

---

## 14. Dependencias principales

```json
{
    "dependencies": {
        "@apollo/client": "^3.11.0",
        "graphql": "^16.9.0",
        "react": "^18.3.0",
        "react-dom": "^18.3.0",
        "react-router-dom": "^6.26.0"
    },
    "devDependencies": {
        "vite": "^5.4.0",
        "@vitejs/plugin-react": "^4.3.0",
        "tailwindcss": "^3.4.0",
        "typescript": "^5.5.0"
    }
}
```

---

## 15. Consideraciones de seguridad

- Token JWT en `localStorage` (solo para versión web)
- URL del servidor configurable, no hardcodeada en el bundle
- Validar siempre que `user.role === "COCINERO"` antes de mostrar la UI de cocina

---

## 16. Diferencias clave: Plan Original vs Adaptación al Proyecto Existente (Solo Web)

| Aspecto       | Plan Original                          | Adaptación Actual                                      |
| ------------- | -------------------------------------- | ------------------------------------------------------ |
| Proyecto base | Nuevo proyecto "smartkitchen-electron" | Reutiliza el proyecto `electron-Restaurante` existente |
| Estado global | Zustand                                | React Context API (KitchenContext)                     |
| WebSocket     | Nuevo KitchenWebSocketService          | Reutiliza WebSocketContext existente                   |
| Persistencia  | electron-store                         | localStorage (web)                                     |
| Soporte web   | No                                     | Sí, desde la Landing Page                              |
| Rutas         | Router nuevo                           | Reutiliza App.tsx existente con rutas nuevas           |

## 17. Diferencias respecto al Android

| Característica | Android                      | Web                                                             |
| -------------- | ---------------------------- | --------------------------------------------------------------- |
| TTS            | Android `TextToSpeech` API   | Web Speech API (`speechSynthesis`)                              |
| Persistencia   | Jetpack DataStore            | localStorage (web)                                              |
| Keep screen on | `FLAG_KEEP_SCREEN_ON`        | Wake Lock API (si está disponible)                              |
| DI             | Hilt                         | React Context API                                               |
| Notificaciones | Android Notification         | Web Notifications API                                           |
| Device ID      | `Settings.Secure.ANDROID_ID` | `getDeviceId()` del AuthContext (UUID generado en el navegador) |
| WebSocket      | OkHttp `WebSocketListener`   | WebSocketContext existente                                      |
