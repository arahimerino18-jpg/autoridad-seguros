/**
 * Content Studio — Channel Registry
 * Autoridad Seguros AI™
 *
 * THE ARCHITECTURAL CORE: Every content type is a registered adapter.
 * The generation engine reads from this registry — it never has hardcoded
 * channel logic. Adding a new channel = adding a new entry here.
 *
 * Phase 6 UI: 8 channels ACTIVE
 * Phase 7+:   SMS, Email, Pinterest activate by changing status to 'active'
 *
 * NEVER modify the engine (content-engine.ts) to add a new channel.
 * ALWAYS add a new ChannelAdapter entry here.
 */

// ─── Core types ───────────────────────────────────────────────────────────────

export type ChannelId =
  // Phase 6 — Active
  | 'instagram_post'
  | 'facebook_post'
  | 'linkedin_post'
  | 'nextdoor_post'
  | 'carousel'
  | 'story'
  | 'reel_script'
  | 'whatsapp'
  // Phase 7+ — Registered but UI not exposed yet
  | 'tiktok_script'
  | 'video_educativo'
  | 'email_marketing'
  | 'sms'
  | 'pinterest'
  | 'hook'
  | 'cta_pack'
  | 'hashtag_pack'

export type ChannelFamily =
  | 'static_post'       // Instagram, Facebook, LinkedIn, Nextdoor, Pinterest
  | 'visual_sequence'   // Carousel, Story
  | 'video_script'      // Reel, TikTok, Video educativo
  | 'direct_message'    // WhatsApp, SMS, Email
  | 'component'         // Hook, CTA, Hashtags

export type ChannelStatus = 'active' | 'beta' | 'coming_soon'

// ─── Output schemas (what Claude must return for each channel) ─────────────────

// Static post (Instagram, Facebook, LinkedIn, Nextdoor)
export interface StaticPostOutput {
  hook: string                    // Opening line that stops the scroll
  cuerpo: string                  // Main body with emojis
  cta: string                     // Call to action
  hashtags: {
    producto: string[]            // 10 product-specific hashtags
    audiencia: string[]           // 10 audience hashtags
    marca: string[]               // 10 brand/agent hashtags
  }
  texto_imagen?: string           // Max 5 words for the image overlay
  alt_text?: string               // Accessibility alt text for the image
}

// Carousel
export interface CarouselOutput {
  hook_slide: {                   // Slide 1
    titulo: string                // Bold headline
    subtitulo: string             // Supporting text
    emoji_principal: string
  }
  slides: Array<{                 // Slides 2-N
    numero: number
    titulo: string
    cuerpo: string
    emoji: string
    tipo: 'contenido' | 'dato' | 'ejemplo' | 'pregunta'
  }>
  cta_slide: {                    // Last slide
    titulo: string
    cta: string
    handle: string                // Injected from brand_kit
    dato_contacto: string         // Phone or WhatsApp from brand_kit
  }
  caption: string                 // Post caption (below the carousel)
  hashtags: {
    producto: string[]
    audiencia: string[]
    marca: string[]
  }
}

// Story / Historia
export interface StoryOutput {
  slides: Array<{
    numero: number
    texto_principal: string       // Max 3 words (very short for story format)
    texto_secundario?: string     // Optional supporting text
    sticker_sugerido?: string     // Poll, question, slider
    cta_swipe_up?: string         // If last slide
    emoji: string
  }>
  caption_acompanante: string     // Post that goes with the story
}

// Reel / TikTok script
export interface ReelScriptOutput {
  hook: string                    // First 3 seconds — must be a scroll-stopper
  segmentos: Array<{
    numero: number
    tiempo_inicio: string         // '0:00'
    tiempo_fin: string            // '0:05'
    texto_locutor: string         // What to say (for teleprompter)
    texto_pantalla: string        // Text overlay on screen
    accion_fisica: string         // What to do physically (walk, point, hold paper)
    tipo: 'hook' | 'desarrollo' | 'punto' | 'transicion' | 'cta'
  }>
  cta_final: string               // The call to action at the end
  caption: string                 // Post caption
  hashtags: {
    producto: string[]
    audiencia: string[]
    marca: string[]
  }
  nota_produccion: string         // Production tips (lighting, background, etc.)
}

// WhatsApp
export interface WhatsAppOutput {
  version_larga: string           // Full message with markdown (bold, italic)
  version_corta: string           // Under 160 chars for quick send
  estructura: Array<{
    bloque: string
    tipo: 'saludo' | 'gancho' | 'cuerpo' | 'beneficio' | 'cta' | 'firma'
  }>
}

// Video educativo (Phase 7)
export interface VideoEducativoOutput {
  titulo: string
  duracion_estimada: string       // '3-4 minutos'
  introduccion: string
  puntos_principales: Array<{
    numero: number
    titulo: string
    desarrollo: string
    ejemplo: string
  }>
  conclusion: string
  cta_final: string
  caption: string
  hashtags: { producto: string[]; audiencia: string[]; marca: string[] }
}

// Email (Phase 8)
export interface EmailOutput {
  subject: string
  preview_text: string            // Preview shown in email clients
  saludo: string
  cuerpo_html: string             // HTML-like formatted body
  cta_boton: string               // Button text
  cta_url_placeholder: string     // Where the button links
  posdata: string                 // P.S. — highest read section
  pie_compliance: string          // Legal footer (auto-populated from brand_kit)
}

// SMS (Phase 8)
export interface SmsOutput {
  mensaje: string                 // Max 160 chars
  caracteres: number
  segmentos: number               // 1 = under 160, 2 = 161-306, etc.
  opt_out: string                 // Always: "Responde STOP para no recibir más"
}

// Pinterest (Phase 7)
export interface PinterestOutput {
  titulo: string                  // Max 100 chars, SEO-optimized
  descripcion: string             // Max 500 chars
  keywords: string[]              // Pinterest search keywords
  tablero_sugerido: string
}

// Component outputs
export interface HookPackOutput {
  hooks: Array<{
    texto: string
    tipo: 'pregunta' | 'dato' | 'provocacion' | 'historia' | 'contradiccion'
    canal_optimo: string
  }>
}

export interface CtaPackOutput {
  ctas: Array<{
    texto: string
    canal: string
    intensidad: 'suave' | 'medio' | 'directo'
  }>
}

export interface HashtagPackOutput {
  por_categoria: {
    producto: string[]
    audiencia: string[]
    ubicacion: string[]
    educacion: string[]
    marca: string[]
  }
  set_30: string[]                // Curated set of exactly 30
}

// Union of all outputs
export type ContentOutput =
  | StaticPostOutput
  | CarouselOutput
  | StoryOutput
  | ReelScriptOutput
  | WhatsAppOutput
  | VideoEducativoOutput
  | EmailOutput
  | SmsOutput
  | PinterestOutput
  | HookPackOutput
  | CtaPackOutput
  | HashtagPackOutput

// ─── Channel Adapter ──────────────────────────────────────────────────────────

export interface ChannelAdapter {
  id: ChannelId
  familia: ChannelFamily
  label: string
  emoji: string
  status: ChannelStatus

  // Technical specs
  specs: {
    max_chars_caption?: number
    max_hashtags?: number
    max_slides?: number
    max_duration_seg?: number
    aspect_ratio?: string
    requiere_hook: boolean
    output_is_json: boolean
    context_depth: 'full' | 'medium' | 'minimal'  // Token optimization
  }

  // The JSON schema Claude must produce (as a type string for the prompt)
  output_type: string             // e.g., 'StaticPostOutput'

  // Channel-specific format instruction injected into the user message
  format_instruction: string

  // Compliance rules specific to this channel
  compliance_additions: string[]

  // UI configuration
  ui: {
    preview_component: string     // Which React component renders the preview
    icon_color: string
    show_in_quick_actions: boolean
    show_in_phase_6: boolean      // Controls visibility without removing from registry
  }
}

// ─── The Registry ─────────────────────────────────────────────────────────────

export const CHANNEL_REGISTRY: Record<ChannelId, ChannelAdapter> = {

  // ─── FAMILY 1: STATIC POSTS ─────────────────────────────────────────────────

  instagram_post: {
    id: 'instagram_post',
    familia: 'static_post',
    label: 'Post de Instagram',
    emoji: '📸',
    status: 'active',
    specs: {
      max_chars_caption: 2200,
      max_hashtags: 30,
      aspect_ratio: '4:5',
      requiere_hook: true,
      output_is_json: true,
      context_depth: 'full',
    },
    output_type: 'StaticPostOutput',
    format_instruction: `Genera un post para Instagram.
ESTRUCTURA: hook (primera línea que para el scroll) + cuerpo con emojis + CTA + hashtags.
El hook debe ser la primera línea del caption — no un saludo.
Máximo 2,200 caracteres en el caption total.
30 hashtags exactos agrupados en 3 categorías de 10.
texto_imagen: máximo 5 palabras para el texto en la imagen.
Usa saltos de línea y emojis estratégicamente.`,
    compliance_additions: [],
    ui: {
      preview_component: 'IGPreview',
      icon_color: '#E1306C',
      show_in_quick_actions: true,
      show_in_phase_6: true,
    },
  },

  facebook_post: {
    id: 'facebook_post',
    familia: 'static_post',
    label: 'Post de Facebook',
    emoji: '👍',
    status: 'active',
    specs: {
      max_chars_caption: 5000,
      max_hashtags: 10,
      aspect_ratio: '1.91:1',
      requiere_hook: true,
      output_is_json: true,
      context_depth: 'full',
    },
    output_type: 'StaticPostOutput',
    format_instruction: `Genera un post para Facebook.
Facebook permite más texto que Instagram. El cuerpo puede ser más largo y narrativo.
El hook puede ser una pregunta o una historia corta — Facebook penaliza menos el texto largo.
Máximo 10 hashtags (Facebook no beneficia hashtags masivos).
El tono puede ser ligeramente más conversacional que Instagram.`,
    compliance_additions: [],
    ui: {
      preview_component: 'FBPreview',
      icon_color: '#1877F2',
      show_in_quick_actions: false,
      show_in_phase_6: true,
    },
  },

  linkedin_post: {
    id: 'linkedin_post',
    familia: 'static_post',
    label: 'Post de LinkedIn',
    emoji: '💼',
    status: 'active',
    specs: {
      max_chars_caption: 3000,
      max_hashtags: 5,
      requiere_hook: true,
      output_is_json: true,
      context_depth: 'full',
    },
    output_type: 'StaticPostOutput',
    format_instruction: `Genera un post para LinkedIn.
TONO: Más profesional que Instagram o Facebook. Sin exceso de emojis.
La audiencia en LinkedIn incluye colegas agentes, empresarios, y prospectos profesionales.
El hook puede ser un insight de industria o una estadística.
Máximo 5 hashtags. Sin hashtags de audiencia general — solo de industria.
El contenido puede incluir perspectiva profesional y credenciales.`,
    compliance_additions: [
      'En LinkedIn, el contenido de seguros puede ser más técnico — la audiencia es profesional.',
      'Mencionar licencias y certificaciones es apropiado y agrega credibilidad.',
    ],
    ui: {
      preview_component: 'LinkedInPreview',
      icon_color: '#0A66C2',
      show_in_quick_actions: false,
      show_in_phase_6: true,
    },
  },

  nextdoor_post: {
    id: 'nextdoor_post',
    familia: 'static_post',
    label: 'Post de Nextdoor',
    emoji: '🏘️',
    status: 'active',
    specs: {
      max_chars_caption: 3000,
      max_hashtags: 0,
      requiere_hook: false,
      output_is_json: true,
      context_depth: 'medium',
    },
    output_type: 'StaticPostOutput',
    format_instruction: `Genera un post para Nextdoor.
TONO MUY IMPORTANTE: Nextdoor es una comunidad de vecinos. El tono debe ser extremadamente local, cálido, y vecinal. No publicitario.
Sin hashtags — Nextdoor no usa hashtags.
Mencionar el vecindario o ciudad específica si está disponible.
El contenido debe parecer que viene de un vecino que quiere ayudar, no de una empresa.
Evitar lenguaje de ventas. Enfatizar el servicio a la comunidad local.`,
    compliance_additions: [
      'Nextdoor tiene políticas estrictas contra spam. El contenido debe aportar valor real a la comunidad.',
      'No publicar el mismo mensaje repetidamente — Nextdoor puede suspender la cuenta.',
    ],
    ui: {
      preview_component: 'GenericPostPreview',
      icon_color: '#00B246',
      show_in_quick_actions: false,
      show_in_phase_6: true,
    },
  },

  // Phase 7 — registered but not shown in Phase 6 UI
  pinterest: {
    id: 'pinterest',
    familia: 'static_post',
    label: 'Idea de Pinterest',
    emoji: '📌',
    status: 'coming_soon',
    specs: {
      max_chars_caption: 500,
      max_hashtags: 0,
      requiere_hook: false,
      output_is_json: true,
      context_depth: 'minimal',
    },
    output_type: 'PinterestOutput',
    format_instruction: `Genera contenido para Pinterest.
Pinterest es una plataforma de búsqueda visual, no de social media.
El título y descripción deben ser SEO-optimizados con keywords de búsqueda.
El tono es informativo e inspiracional, no conversacional.`,
    compliance_additions: [],
    ui: {
      preview_component: 'PinterestPreview',
      icon_color: '#E60023',
      show_in_quick_actions: false,
      show_in_phase_6: false,  // Activated in Phase 7
    },
  },

  // ─── FAMILY 2: VISUAL SEQUENCES ─────────────────────────────────────────────

  carousel: {
    id: 'carousel',
    familia: 'visual_sequence',
    label: 'Carrusel',
    emoji: '📊',
    status: 'active',
    specs: {
      max_slides: 10,
      aspect_ratio: '4:5',
      max_hashtags: 30,
      requiere_hook: true,
      output_is_json: true,
      context_depth: 'full',
    },
    output_type: 'CarouselOutput',
    format_instruction: `Genera un carrusel de Instagram.
ESTRUCTURA:
- Slide 1 (hook_slide): El gancho. Debe hacer que el usuario quiera deslizar. Pregunta o promesa fuerte.
- Slides 2-N (slides): Máximo 9 slides de contenido. Cada slide = 1 idea. Corto y visual.
- Último slide (cta_slide): CTA claro con el handle del agente y dato de contacto.

Número ideal de slides: 6-8. Nunca menos de 5, nunca más de 10.
Cada slide debe ser autosuficiente — si alguien solo ve ese slide, debe entender el punto.
caption: resumen del carrusel para quien no desliza (max 300 chars).
30 hashtags exactos en 3 grupos de 10.`,
    compliance_additions: [],
    ui: {
      preview_component: 'CarouselPreview',
      icon_color: '#833AB4',
      show_in_quick_actions: true,
      show_in_phase_6: true,
    },
  },

  story: {
    id: 'story',
    familia: 'visual_sequence',
    label: 'Historia / Story',
    emoji: '⬛',
    status: 'active',
    specs: {
      max_slides: 5,
      aspect_ratio: '9:16',
      max_hashtags: 0,
      requiere_hook: false,
      output_is_json: true,
      context_depth: 'medium',
    },
    output_type: 'StoryOutput',
    format_instruction: `Genera una historia para Instagram/Facebook Stories.
Formato VERTICAL (9:16). El texto debe ser MUY corto — se lee en 5 segundos.
3-5 slides máximo.
texto_principal: máximo 3 palabras por slide — lo que se ve en grande.
texto_secundario: opcional, máximo 10 palabras.
Sugiere stickers interactivos: poll, pregunta, slider de reacción.
El último slide siempre tiene CTA con swipe-up o link en bio.
caption_acompanante: post de texto que acompaña la historia.`,
    compliance_additions: [],
    ui: {
      preview_component: 'StoryPreview',
      icon_color: '#FCAF45',
      show_in_quick_actions: false,
      show_in_phase_6: true,
    },
  },

  // ─── FAMILY 3: VIDEO SCRIPTS ─────────────────────────────────────────────────

  reel_script: {
    id: 'reel_script',
    familia: 'video_script',
    label: 'Guion de Reel / TikTok',
    emoji: '🎬',
    status: 'active',
    specs: {
      max_duration_seg: 90,
      aspect_ratio: '9:16',
      max_hashtags: 30,
      requiere_hook: true,
      output_is_json: true,
      context_depth: 'full',
    },
    output_type: 'ReelScriptOutput',
    format_instruction: `Genera un guion completo para un Reel de Instagram o TikTok.
DURACIÓN: 30-60 segundos ideal. Máximo 90 segundos.

HOOK (primeros 3 segundos): CRÍTICO. Si no para el scroll en 3 segundos, el video falla.
El hook puede ser: pregunta impactante, dato sorprendente, promesa directa, o situación familiar.

SEGMENTOS: Divide el guion en segmentos de 5-10 segundos cada uno.
Para cada segmento incluye:
- texto_locutor: exactamente qué decir (para teleprompter)
- texto_pantalla: texto que aparece como overlay (máximo 5 palabras)
- accion_fisica: qué hace físicamente el agente (camina, señala, muestra papel, etc.)
- tiempo_inicio y tiempo_fin en formato 0:00

nota_produccion: consejo práctico de grabación (fondo, iluminación, ángulo).
caption + 30 hashtags.`,
    compliance_additions: [
      'En videos de Medicare: incluir en el texto_pantalla del último segmento la leyenda "No afiliado a ningún plan gubernamental".',
      'Para videos de IUL: nunca mostrar proyecciones de rendimiento como garantía.',
    ],
    ui: {
      preview_component: 'ReelScriptPreview',
      icon_color: '#FE2C55',
      show_in_quick_actions: true,
      show_in_phase_6: true,
    },
  },

  tiktok_script: {
    id: 'tiktok_script',
    familia: 'video_script',
    label: 'Script TikTok',
    emoji: '🎵',
    status: 'active',
    specs: {
      max_duration_seg: 60,
      aspect_ratio: '9:16',
      max_hashtags: 10,
      requiere_hook: true,
      output_is_json: true,
      context_depth: 'full',
    },
    output_type: 'ReelScriptOutput', // Same schema as reel
    format_instruction: `Genera un guion para TikTok.
TikTok es más informal y rápido que Instagram Reels.
El lenguaje puede ser más coloquial y directo.
Duración ideal: 30-45 segundos. Máximo 60 segundos.
Hook aún más agresivo — TikTok tiene usuarios con menor tolerancia al aburrimiento.
Los trends de TikTok son más relevantes aquí (aunque el contenido debe ser evergreen).
Máximo 10 hashtags — TikTok no beneficia hashtags masivos.`,
    compliance_additions: [
      'TikTok tiene audiencia más joven. Asegura que el tono sea apropiado para adultos jóvenes (25-45) interesados en seguros.',
    ],
    ui: {
      preview_component: 'ReelScriptPreview',
      icon_color: '#000000',
      show_in_quick_actions: false,
      show_in_phase_6: true,  // Activated in Phase 7
    },
  },

  video_educativo: {
    id: 'video_educativo',
    familia: 'video_script',
    label: 'Video educativo',
    emoji: '🎓',
    status: 'coming_soon',
    specs: {
      max_duration_seg: 300,
      max_hashtags: 15,
      requiere_hook: true,
      output_is_json: true,
      context_depth: 'full',
    },
    output_type: 'VideoEducativoOutput',
    format_instruction: `Genera el guion de un video educativo largo (2-5 minutos).
Estructura didáctica: introducción + 3-4 puntos principales + conclusión + CTA.
Para YouTube, LinkedIn, o Facebook Watch.`,
    compliance_additions: [],
    ui: {
      preview_component: 'VideoScriptPreview',
      icon_color: '#FF0000',
      show_in_quick_actions: false,
      show_in_phase_6: true,   // Activated in Phase 7
    },
  },

  // ─── FAMILY 4: DIRECT MESSAGES ──────────────────────────────────────────────

  whatsapp: {
    id: 'whatsapp',
    familia: 'direct_message',
    label: 'Mensaje WhatsApp',
    emoji: '💬',
    status: 'active',
    specs: {
      requiere_hook: false,
      output_is_json: true,
      context_depth: 'medium',
    },
    output_type: 'WhatsAppOutput',
    format_instruction: `Genera un mensaje de WhatsApp para marketing.
FORMATO NATIVO DE WHATSAPP:
- *negrita* para resaltar
- _cursiva_ para énfasis
- ~tachado~ si es necesario
- Emojis son apropiados y esperados

Genera DOS versiones:
1. version_larga: mensaje completo con toda la información (para prospectos nuevos)
2. version_corta: bajo 160 caracteres (para seguimiento rápido)

Estructura también el mensaje por bloques para que el agente pueda editarlo fácilmente.`,
    compliance_additions: [
      'WhatsApp marketing requiere consentimiento previo del receptor (opt-in).',
      'Agregar siempre opción de no recibir más mensajes: "Responde STOP para no recibir más mensajes."',
      'No enviar más de 1 mensaje no solicitado — puede resultar en baneo de la cuenta.',
    ],
    ui: {
      preview_component: 'WhatsAppPreview',
      icon_color: '#25D366',
      show_in_quick_actions: true,
      show_in_phase_6: true,
    },
  },

  sms: {
    id: 'sms',
    familia: 'direct_message',
    label: 'SMS',
    emoji: '📱',
    status: 'coming_soon',
    specs: {
      max_chars_caption: 160,
      requiere_hook: false,
      output_is_json: true,
      context_depth: 'minimal',
    },
    output_type: 'SmsOutput',
    format_instruction: `Genera un mensaje SMS. Máximo 160 caracteres incluyendo el opt-out.
Sin emojis (no compatibles con todos los carriers). Sin links largos (usar shortener).`,
    compliance_additions: [
      'TCPA REQUIRED: Incluir siempre "Responde STOP para no recibir más. Msg&Data rates may apply."',
      'El SMS solo puede enviarse a números que dieron consentimiento expreso.',
      'Sin llamadas a la acción que impliquen urgencia artificial.',
    ],
    ui: {
      preview_component: 'SmsPreview',
      icon_color: '#5856D6',
      show_in_quick_actions: false,
      show_in_phase_6: false,
    },
  },

  email_marketing: {
    id: 'email_marketing',
    familia: 'direct_message',
    label: 'Email de marketing',
    emoji: '📧',
    status: 'coming_soon',
    specs: {
      requiere_hook: true,
      output_is_json: true,
      context_depth: 'full',
    },
    output_type: 'EmailOutput',
    format_instruction: `Genera un email de marketing completo.
Subject line: máximo 50 caracteres, alta tasa de apertura.
Preview text: máximo 90 caracteres, complementa el subject.
Estructura: saludo personalizado + cuerpo + CTA + posdata + pie de compliance.`,
    compliance_additions: [
      'CAN-SPAM: Incluir siempre dirección física del agente.',
      'Incluir enlace de "Darse de baja" en el pie.',
      'Subject no puede ser engañoso ni usar ALL CAPS.',
      'Para Medicare: incluir el NPN del agente en el pie.',
    ],
    ui: {
      preview_component: 'EmailPreview',
      icon_color: '#EA4335',
      show_in_quick_actions: false,
      show_in_phase_6: false,
    },
  },

  // ─── FAMILY 5: COMPONENTS ────────────────────────────────────────────────────

  hook: {
    id: 'hook',
    familia: 'component',
    label: 'Pack de Hooks',
    emoji: '🪝',
    status: 'coming_soon',
    specs: {
      requiere_hook: false,
      output_is_json: true,
      context_depth: 'medium',
    },
    output_type: 'HookPackOutput',
    format_instruction: `Genera 5 hooks variados para el tema dado.
Un hook por tipo: pregunta, dato sorprendente, provocación, historia corta, contradicción.`,
    compliance_additions: [],
    ui: {
      preview_component: 'ComponentPreview',
      icon_color: '#FF9500',
      show_in_quick_actions: false,
      show_in_phase_6: false,
    },
  },

  cta_pack: {
    id: 'cta_pack',
    familia: 'component',
    label: 'Pack de CTAs',
    emoji: '📢',
    status: 'coming_soon',
    specs: {
      requiere_hook: false,
      output_is_json: true,
      context_depth: 'minimal',
    },
    output_type: 'CtaPackOutput',
    format_instruction: 'Genera 5 CTAs variados. Suave, medio, y directo. Para diferentes canales.',
    compliance_additions: [],
    ui: {
      preview_component: 'ComponentPreview',
      icon_color: '#FF3B30',
      show_in_quick_actions: false,
      show_in_phase_6: false,
    },
  },

  hashtag_pack: {
    id: 'hashtag_pack',
    familia: 'component',
    label: 'Pack de Hashtags',
    emoji: '#️⃣',
    status: 'coming_soon',
    specs: {
      requiere_hook: false,
      output_is_json: true,
      context_depth: 'minimal',
    },
    output_type: 'HashtagPackOutput',
    format_instruction: 'Genera 30 hashtags organizados por categoría. Incluye el set de 30 listo para copiar.',
    compliance_additions: [],
    ui: {
      preview_component: 'ComponentPreview',
      icon_color: '#34C759',
      show_in_quick_actions: false,
      show_in_phase_6: false,
    },
  },
}

// ─── Registry helpers ─────────────────────────────────────────────────────────

/** Returns only channels visible in Phase 6 UI */
export function getActiveChannels(): ChannelAdapter[] {
  return Object.values(CHANNEL_REGISTRY).filter(
    (c) => c.ui.show_in_phase_6
  )
}

/** Returns channels grouped by family */
export function getChannelsByFamily(): Record<ChannelFamily, ChannelAdapter[]> {
  const result = {} as Record<ChannelFamily, ChannelAdapter[]>
  for (const channel of Object.values(CHANNEL_REGISTRY)) {
    if (!channel.ui.show_in_phase_6) continue
    if (!result[channel.familia]) result[channel.familia] = []
    result[channel.familia].push(channel)
  }
  return result
}

/** Returns a channel adapter by ID */
export function getChannel(id: ChannelId): ChannelAdapter {
  const channel = CHANNEL_REGISTRY[id]
  if (!channel) throw new Error(`Channel '${id}' not found in registry`)
  return channel
}

/** Returns channels for quick actions widget */
export function getQuickActionChannels(): ChannelAdapter[] {
  return Object.values(CHANNEL_REGISTRY).filter(
    (c) => c.ui.show_in_quick_actions && c.ui.show_in_phase_6
  )
}
