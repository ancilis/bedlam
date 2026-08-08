

# Bedlam

**Bedlam es un plano de control de IA para empresas de código abierto y enfoque local-first. Ejecute equipos de agentes de IA con organigramas, ciclos de trabajo gobernados, presupuestos, aprobaciones, espacios de trabajo de ejecución, enrutamiento de modelos y capacidad de auditoría.**

Bedlam permite a un operador ejecutar una empresa nativa de IA de extremo a extremo: definir objetivos, contratar agentes, asignar trabajo, hacer cumplir presupuestos, revisar aprobaciones, inspeccionar la ejecución y mejorar la empresa de forma segura mediante ciclos de plano de control auditables.

---

## 5-Minute Demo: AI Engineering Company

Ejecute un plano de control de empresa de agentes local-first con datos de fixture deterministas. No se requiere un modelo externo, clave API o CLI de agente para la semilla de la demo.

```sh
npx @ancilis/bedlam demo ai-engineering --yes && npx @ancilis/bedlam run
```

Abra `http://localhost:3100`, seleccione **Bedlam AI Engineering Company** y debería ver:

- una misión, objetivos, organigrama, presupuestos y siete agentes: CEO, CTO, Ingeniero, Revisor, Merger, Administrador de Presupuesto y Administrador de Calidad
- proyecto **Improve Bedlam** con problemas obsoletos, bloqueados, seguimiento de ejecuciones fallidas, backlog de alta prioridad, cola de revisión y problemas de política de seguridad
- un ciclo activo de **Throughput Optimizer** con una acción de ejecución en un clic
- observaciones y propuestas en **Loops**
- al menos un resultado duradero de aprendizaje y propuesta en el **Company Operating Ledger**

Por qué es importante: Bedlam no solo ejecuta agentes aislados. Ofrece a una empresa nativa de IA ciclos gobernados, límites de presupuesto, propuestas revisables y memoria operativa duradera.

¿Ya completó el onboarding?

```sh
bedlam demo ai-engineering && bedlam run
```

Recorrido completo: [`docs/demo-ai-engineering-company.md`](docs/demo-ai-engineering-company.md).

---

## What Bedlam Provides

Bedlam está construido para operaciones de empresas de agentes local-first:

### Coordinación Estigmergica
Los agentes se comunican indirectamente a través de un estado ambiental compartido en lugar de pasar mensajes directos. Esto permite que grandes equipos de agentes se autoorganicen alrededor del trabajo sin un acoplamiento estrecho o cuellos de botella de orquestación centralizada. Los agentes dejan rastros; otros agentes responden a esos rastros.

### Patrones de Calidad Basados en Reflexión
Los agentes evalúan sus propias salidas antes de mostrar los resultados. Los ciclos de reflexión están integrados en la tubería de ejecución: un agente produce un resultado, lo critica contra criterios de calidad definidos y itera hasta que la salida cumple con el estándar o escala a un aprobador humano.

### Enrutamiento Dinámico de Modelos
La asignación de modelos se basa en el tipo de tarea, no en una configuración estática. El trabajo intensivo en diseño y arquitectura se enruta a modelos de nivel fronterizo (Claude Opus, OpenAI o3/GPT-5). La ejecución estándar se enruta a clase Sonnet. Las tareas mecánicas y repetitivas se enrutan a clase Haiku. El agente CTO puede parchear las asignaciones de modelos dinámicamente antes de despertar a los agentes a través de la API. Con el adaptador OpenRouter, la misma lógica de enrutamiento abarca cualquier modelo disponible en [openrouter.ai](https://openrouter.ai) — Anthropic, OpenAI, Google, Meta, DeepSeek, Mistral, xAI y más — a través de una sola clave API.

### Sistema de Personalización de Personajes de Agentes ([AGENTS.md](http://AGENTS.md) + [SOUL.md](http://SOUL.md))

Cada agente tiene dos archivos de definición:

- [**AGENTS.md**](http://AGENTS.md) — rol, responsabilidades, autoridad de decisión, vías de escalación y reglas operativas
- [**SOUL.md**](http://SOUL.md) — personalidad, estilo de comunicación, valores y valores predeterminados de comportamiento

Esto otorga a los agentes identidades consistentes y predecibles en sesiones de larga duración y colaboraciones multiagente.

### Protocolos de Latido AOA

Los agentes emiten señales de latido estructuradas durante la ejecución. Estas señales transportan el estado de la tarea, niveles de confianza y banderas de dependencia. Otros agentes y el plano de control utilizan los latidos para coordinar la secuencia, detectar estancamientos y desencadenar intervenciones sin sondeo.

### Implementación Local Lista para Usar

Bedlam está diseñado para ejecutarse completamente en su propio hardware. Postgres embebido se incluye de fábrica para ejecuciones locales sin configuración. Se incluyen configuraciones de Docker Compose para implementaciones en contenedores. No se requiere cuenta en la nube.

### Autonomía de Bloqueo

Los problemas tienen campos de bloqueo estructurados (`blockedByIssueIds`, `blockedReason`, `needsHumanAt`, `needsHumanReason`, `selfFixAttempts`). Un programador interno desbloquea automáticamente los problemas cuando se completan sus dependencias (`blocker_reconciler`), marca los problemas bloqueados por demasiado tiempo para atención humana (`stale_blocked_escalator`) y escribe un resumen de estado diario legible por humanos (`daily_status_writer`). Un contrato de comportamiento para agentes ingenieros (`docs/agent-contracts/block-handling.md`) asegura que los agentes intenten la autocorrección antes de bloquearse y utilicen `needsHumanAt` para problemas de autenticación/credenciales. Los operadores ven solo lo que genuinamente necesita su intervención, no una cola completa de bloqueos. Consulte `docs/blocker-autonomy.md`.

### Ciclos de Reflexión de la Empresa

Los Ciclos de Reflexión de la Empresa son ciclos de auto-mejora gobernados y auditables para empresas de Bedlam. Un ciclo observa el estado de la empresa, diagnostica cuellos de botella, propone cambios tipados, evalúa esos cambios, solicita aprobación cuando sea necesario, aplica acciones aprobadas seguras y registra aprendizajes.

El primer tipo de ciclo es `throughput_optimizer`. Inspecciona de manera determinista problemas y ejecuciones de latido para trabajos bloqueados, problemas activos obsoletos, ejecuciones fallidas o con tiempo de espera agotado, bloqueadores resueltos que aún están marcados como bloqueados y colas de alta prioridad sobrecargadas. Los primeros tipos de propuestas ejecutables son intencionalmente estrechos:

- `add_issue_comment` — comentarios de seguimiento de bajo riesgo en problemas afectados
- `create_issue` — elementos de trabajo de triaje de riesgo medio que requieren aprobación por defecto

Las propuestas de configuración directa de agentes, presupuesto, enrutamiento de modelos, instalación de plugins y modificación de código no son ejecutables intencionalmente en esta base.

### Plantillas de Agentes de Seguimiento

Un modo de fallo común en la ingeniería impulsada por agentes: los agentes abren PRs, pierden interés, recogen nuevo trabajo y los PRs sin fusionar se acumulan en 30–60+ ramas huérfanas y docenas de tickets `in_review` que nunca se cierran. Bedlam entrega plantillas probadas en producción que cierran este ciclo:

- **Merger** — aterriza PRs aprobados (squash-merge, eliminar rama, cerrar problema, desbloquear problema dependiente); revierte la fusión si la CI principal se pone en rojo en 10 minutos
- **Branch Steward** — cosecha diaria de ramas con referencia cruzada de Bedlam; elimina ramas fusionadas en main, archiva las prematuras, comenta en ramas fantasma
- **Pipeline Coordinator** — cumplimiento horario de SLA (SLA de revisión de 24h → reasignación entre pools), revierte `in_progress` obsoletos, publica un Informe Diario de Salud de Pipeline con métricas de throughput

Más dos bloques `AGENTS.md` plug-and-play para agentes existentes:

- `engineer-definition-of-done.md` — los 5 criterios de completado + seguimiento post-PR + reglas de respaldo inactivo
- `reviewer-review-sla.md` — SLA de revisión de 24h + comportamiento de reasignación entre pools

Más una regla de programador (implementación Python de referencia): **1 problema `in_progress` por ingeniero**, con reversión automática del exceso a `todo`.

Consulte [`templates/`](./templates/) para los agentes y bloques; [`docs/agent-contracts/`](./docs/agent-contracts/) para las especificaciones de políticas (definition-of-done, review-sla, in-progress-cap).

---

## Quick Start

La forma más rápida de poner en funcionamiento Bedlam:

```sh
npx @ancilis/bedlam onboard --yes
```

Esto guía por la configuración, configura su entorno e inicia el servidor en `http://localhost:3100`. Volver a ejecutar `onboard` conserva su configuración y datos existentes. Use `bedlam configure` para editar la configuración más tarde.

Ejecuciones posteriores:

```sh
npx @ancilis/bedlam run
```

### Working from a clone (contributors)

```sh
pnpm install
pnpm dev
```

Para reiniciar la base de datos local de desarrollo:

```sh
rm -rf ~/.bedlam/instances/default/db
pnpm dev
```

Para implementaciones de larga duración, consulte [Production Deployment](#production-deployment-macos) a continuación: no ejecute `pnpm dev` en una terminal para siempre.

---

## Repo Structure

```
server/                Express REST API y servicios de orquestación
ui/                    UI de tablero React + Vite
cli/                   CLI para configuración, onboarding y comandos de plano de control
packages/
  db/                  Esquema Drizzle, migraciones, clientes de DB
  shared/              Tipos compartidos, constantes, validadores, constantes de rutas API
  adapter-utils/       Utilidades compartidas para implementaciones de adaptadores
  adapters/            Implementaciones de adaptadores de agentes (ver sección Adaptadores)
  plugins/             Paquetes del sistema de plugins
doc/                   Documentación operativa y de producto
docs/                  Documentación pública (Mintlify)
skills/                Definiciones de habilidades reutilizables de agentes
```

---

## Adapters

Los adaptadores conectan la capa de orquestación de Bedlam con tiempos de ejecución específicos de agentes. Cada adaptador sabe cómo invocar un agente, capturar su salida e informar el uso de tokens. Usted elige el adaptador por agente: diferentes agentes en la misma empresa pueden ejecutarse en diferentes runtimes.

| Adaptador | Clave de Tipo | Qué Ejecuta |
|---------|----------|--------------|
| Claude Local | `claude_local` | Claude Code CLI, localmente |
| Codex Local | `codex_local` | OpenAI Codex CLI, localmente |
| Gemini Local | `gemini_local` | Gemini CLI, localmente |
| OpenCode Local | `opencode_local` | OpenCode CLI, multi-proveedor vía `provider/model` |
| Cursor | `cursor` | Cursor en modo de fondo |
| Pi Local | `pi_local` | Agente Pi embebido, localmente |
| OpenClaw Gateway | `openclaw_gateway` | Punto de conexión de puerta de enlace del ecosistema Paperclip upstream |
| **OpenRouter** | `openrouter` | **Cualquier modelo en OpenRouter: Anthropic, OpenAI, Google, Meta, DeepSeek, Mistral, xAI y más, a través de una sola clave API** |
| Process | `process` | Comandos de shell arbitrarios |
| HTTP | `http` | Webhooks a agentes externos |

### OpenRouter

El adaptador OpenRouter le permite enrutar cualquier agente a cualquier modelo disponible en [openrouter.ai](https://openrouter.ai) usando una clave API y una cuenta de facturación. Útil cuando desea diferentes agentes en diferentes proveedores sin gestionar credenciales separadas, o cuando necesita acceso a modelos que no tienen un adaptador CLI dedicado (Llama, Mistral, Grok, DeepSeek, etc).

```json
{
  "adapterType": "openrouter",
  "adapterConfig": {
    "apiKey": "sk-or-...",
    "model": "anthropic/claude-sonnet-4-5",
    "instructionsFilePath": "/absolute/path/to/AGENTS.md",
    "maxTokens": 4096,
    "temperature": 0.5
  }
}
```

Especifique cualquier modelo en formato `provider/model` — `anthropic/claude-opus-4`, `openai/gpt-4.1`, `openai/o3`, `google/gemini-2.5-pro`, `meta-llama/llama-4-maverick`, `deepseek/deepseek-r2`, `x-ai/grok-3`. El uso de tokens se captura desde la respuesta y se atribuye al facturador `openrouter` para el seguimiento de costos. Referencia completa: `docs/adapters/openrouter.md`.

### Building Your Own Adapter

Cada adaptador es un paquete de workspace bajo `packages/adapters/<name>/` con un módulo de servidor (ejecuta el agente), un módulo de UI (renderiza transcripciones de ejecución y formularios de configuración) y un módulo de CLI (formatea la salida para `bedlam run --watch`). Consulte `docs/adapters/creating-an-adapter.md`.

---

## Agent Configuration

Defina su equipo de agentes en el directorio `skills/`. Cada agente obtiene:

**`AGENTS.md`** — definición operativa:
```markdown
# Agente CEO

## Rol
Establece la dirección de la empresa, aprueba decisiones importantes, gestiona el equipo directivo.

## Responsabilidades
- Revisar y aprobar planes estratégicos
- Desbloquear agentes con prioridades conflictivas
- Escalar excedentes de presupuesto al operador humano

## Autoridad de Decisión
- Puede aprobar tareas hasta un presupuesto de $50
- No puede modificar la arquitectura central sin aprobación humana
```

**`SOUL.md`** — definición de comportamiento:
```markdown
# Alma del CEO

Directo y decisivo. Se comunica en oraciones cortas y claras.
Prioriza la claridad sobre la exhaustividad. Se resiste al aumento del alcance.
Valora la velocidad de ejecución sobre la perfección en decisiones reversibles.
```

---

## Docker

```sh
# Standard deployment
docker compose -f docker/docker-compose.yml up

# Quickstart (single command)
docker compose -f docker/docker-compose.quickstart.yml up
```

Consulte `doc/DOCKER.md` para las opciones completas de implementación.

---

## Production Deployment (macOS)

Para implementaciones de larga duración en un Mac, supervise el proceso con un LaunchAgent en lugar de `pnpm dev` en una terminal. El repositorio incluye un instalador de un solo comando:

```sh
./scripts/macos/install.sh
```

Esto genera un secreto JWT de agente nuevo, instala `~/Library/LaunchAgents/ai.bedlam.dev.plist` y inicializa el agente en el dominio de su sesión GUI (`gui/$UID`) para que los adaptadores que dependen del contexto de seguridad de la GUI (autenticación de suscripción de Claude Code, reenvío de agente SSH) funcionen correctamente.

El LaunchAgent usa `KeepAlive` para recuperación ante fallos y un montículo Node de 8 GB. Consulte [`docs/deploy/macos-launchagent.md`](docs/deploy/macos-launchagent.md) para la justificación completa, comandos de ciclo de vida, solución de problemas y la ruta de instalación manual.

Para Linux, el patrón equivalente es una unidad `systemd --user`. Una unidad de referencia está en la hoja de ruta.

---

## Model Routing

Bedlam utiliza un modelo de enrutamiento de tres niveles. La asignación de nivel se basa en el tipo de tarea, no en una configuración estática: el agente CTO puede parchear las asignaciones de modelos dinámicamente antes de despertar a los agentes a través de la API.

| Nivel | Ejemplos (adaptadores directos) | Ejemplos (vía OpenRouter) | Usar Para |
|------|----------------------------|---------------------------|---------|
| Diseño | Claude Opus, GPT-5 (Codex) | `anthropic/claude-opus-4`, `openai/o3` | Arquitectura, estrategia, razonamiento complejo |
| Ejecución | Claude Sonnet | `anthropic/claude-sonnet-4-5`, `openai/gpt-4.1`, `google/gemini-2.5-pro` | Ejecución estándar de tareas, código, análisis |
| Mecánico | Claude Haiku | `anthropic/claude-haiku-3-5`, `openai/gpt-4.1-mini` | Formato, clasificación, transformaciones repetitivas |

Los adaptadores CLI directos (`claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `hermes_local`) le ofrecen ejecución de herramientas, salida en streaming y autenticación de suscripción. El adaptador OpenRouter le ofrece amplitud: cualquier modelo en OpenRouter, una clave API, facturación unificada — a costa de la ejecución de herramientas CLI. Combine y adapte: agentes de escritura de código en adaptadores CLI directos, agentes de razonamiento y revisión en OpenRouter, agentes mecánicos en el que sea más barato.

Configure adaptadores en `packages/adapters/`. La capa de enrutamiento dinámico selecciona el nivel basado en metadatos de tareas antes de que comience la ejecución del agente.

---

## Contributing

Consulte `CONTRIBUTING.md` y `AGENTS.md` para las directrices de contribución y convenciones del repositorio.

---

## Built With Bedlam

Bedlam es la plataforma interna de orquestación de agentes utilizada para construir [Ancilis](https://ancilis.ai) — inteligencia de cumplimiento de agentes para implementaciones empresariales de IA. El equipo de ingeniería de Ancilis ejecuta una implementación multi-equipo de Bedlam para desarrollar la plataforma, con las mejoras de este repositorio desarrolladas y probadas en combate en ese contexto.

Operativamente, el patrón de grado de producción que utilizamos está documentado en `docs/deploy/macos-launchagent.md`: un LaunchAgent supervisado cargado en el dominio de sesión GUI del usuario, con `KeepAlive` para recuperación ante fallos y un montículo Node de 8 GB. El instalador `scripts/macos/install.sh` en este repositorio materializa esa configuración en un solo comando. Anteriormente usamos un vigilante basado en cron y migramos fuera de él porque los procesos generados por cron no pueden acceder a las entradas del llavero de macOS en las que dependen los adaptadores de autenticación de suscripción (notablemente `claude_local`).

---

## Lineage / Attribution

Bedlam comenzó como un fork de [Paperclip](https://github.com/paperclipai/paperclip), originalmente creado por Dotta, y desde entonces ha evolucionado hacia un plano de control de IA para empresas local-first con arquitectura, gobernanza, presupuesto, orquestación, adaptadores, workspace y características operativas sustancialmente específicas de Bedlam.

Las porciones derivadas del Paperclip upstream permanecen bajo la licencia MIT original. Las adiciones de Bedlam están licenciadas bajo Apache 2.0. Consulte `LICENSE`, `NOTICE` y [`docs/lineage.md`](docs/lineage.md) para detalles.

---

## License

Apache 2.0 para las adiciones de Bedlam, con avisos MIT conservados para las porciones derivadas del Paperclip upstream. Consulte `LICENSE` y `NOTICE`.

Las adiciones y mejoras de Bedlam son Copyright (c) 2026 Ancilis, Inc., licenciadas bajo Apache 2.0. Las porciones del Paperclip upstream permanecen bajo la Licencia MIT original. Ambos avisos están incluidos en `LICENSE`.
