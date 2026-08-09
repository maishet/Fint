import type { TransactionType } from '../api/types'

interface IconRule {
  emoji: string
  keywords: string[]
}

// Keywords are normalized (lowercase, diacritics stripped) and mix es/en/pt synonyms per concept
// on purpose, so the same rule matches regardless of the language the user types in.
const rules: IconRule[] = [
  { emoji: '🍽️', keywords: ['comida', 'alimento', 'alimentacion', 'alimentacao', 'restaurante', 'cena', 'almuerzo', 'desayuno', 'food', 'meal', 'dinner', 'lunch', 'breakfast', 'restaurant', 'jantar', 'almoco', 'refeicao', 'comer', 'eat'] },
  { emoji: '☕', keywords: ['cafe', 'coffee', 'cafeteria'] },
  { emoji: '🛒', keywords: ['super', 'supermercado', 'mercado', 'compra', 'compras', 'groceries', 'grocery', 'market', 'feira', 'mercearia'] },
  { emoji: '🚕', keywords: ['transporte', 'taxi', 'uber', 'bus', 'autobus', 'movilidad', 'transport', 'cab', 'ride', 'onibus', 'metro', 'subway', 'metrobus', 'colectivo'] },
  { emoji: '⛽', keywords: ['gasolina', 'combustible', 'fuel', 'gas', 'gasoline', 'petrol', 'combustivel'] },
  { emoji: '🚗', keywords: ['auto', 'carro', 'coche', 'car', 'vehiculo', 'vehicle', 'veiculo'] },
  { emoji: '🅿️', keywords: ['estacionamiento', 'parking', 'estacionamento'] },
  { emoji: '🏠', keywords: ['casa', 'alquiler', 'aluguel', 'hogar', 'home', 'rent', 'vivienda', 'arriendo', 'moradia', 'renta'] },
  { emoji: '🔧', keywords: ['mantenimiento', 'reparacion', 'reparo', 'repair', 'maintenance', 'manutencao', 'plomero', 'electricista', 'plumber'] },
  { emoji: '💡', keywords: ['luz', 'electricidad', 'energia', 'electricity', 'power', 'eletricidade'] },
  { emoji: '💧', keywords: ['agua', 'water'] },
  { emoji: '📶', keywords: ['internet', 'wifi', 'telefono', 'telefone', 'phone', 'celular', 'movil', 'cable'] },
  { emoji: '🧾', keywords: ['servicio', 'servicios', 'service', 'services', 'factura', 'bill', 'conta', 'fatura', 'recibo', 'impuesto', 'impuestos', 'tributo', 'tax', 'taxes', 'imposto'] },
  { emoji: '💊', keywords: ['salud', 'medicina', 'medicamento', 'farmacia', 'doctor', 'health', 'medicine', 'pharmacy', 'saude', 'remedio', 'medico'] },
  { emoji: '🏥', keywords: ['hospital', 'clinica', 'clinic', 'consulta', 'emergencia', 'emergency'] },
  { emoji: '🦷', keywords: ['dentista', 'dental', 'dentist', 'odontologia'] },
  { emoji: '🎓', keywords: ['educacion', 'educacao', 'colegio', 'escuela', 'curso', 'universidad', 'education', 'school', 'course', 'university', 'matricula', 'tuition', 'escola'] },
  { emoji: '📚', keywords: ['libro', 'libros', 'book', 'books', 'livro'] },
  { emoji: '🎬', keywords: ['entretenimiento', 'entretenimento', 'cine', 'cinema', 'pelicula', 'movie', 'ocio', 'diversion', 'lazer'] },
  { emoji: '📺', keywords: ['streaming', 'netflix', 'spotify', 'disney', 'suscripcion', 'subscription', 'assinatura', 'plataforma'] },
  { emoji: '🎮', keywords: ['juego', 'juegos', 'videojuego', 'game', 'games', 'gaming', 'jogo'] },
  { emoji: '🎵', keywords: ['musica', 'music', 'concierto', 'concert', 'show'] },
  { emoji: '✈️', keywords: ['viaje', 'vuelo', 'avion', 'travel', 'flight', 'trip', 'viagem', 'voo'] },
  { emoji: '🏨', keywords: ['hotel', 'hospedaje', 'alojamiento', 'lodging', 'accommodation', 'hospedagem'] },
  { emoji: '🌴', keywords: ['vacacion', 'vacaciones', 'vacation', 'holiday', 'ferias'] },
  { emoji: '🐶', keywords: ['mascota', 'perro', 'gato', 'veterinaria', 'pet', 'dog', 'cat', 'veterinary', 'veterinario'] },
  { emoji: '👕', keywords: ['ropa', 'vestido', 'calzado', 'clothes', 'clothing', 'roupa', 'zapatos', 'shoes', 'sapato'] },
  { emoji: '🎁', keywords: ['regalo', 'obsequio', 'gift', 'presente'] },
  { emoji: '💻', keywords: ['tecnologia', 'computadora', 'software', 'technology', 'computer', 'laptop', 'notebook', 'informatica'] },
  { emoji: '📱', keywords: ['celular', 'smartphone', 'movil'] },
  { emoji: '💼', keywords: ['salario', 'sueldo', 'salary', 'trabajo', 'trabalho', 'job', 'nomina', 'payroll'] },
  { emoji: '🧑‍💻', keywords: ['freelance', 'independiente', 'autonomo', 'negocio', 'business', 'emprendimiento', 'consultoria'] },
  { emoji: '💰', keywords: ['ahorro', 'ahorros', 'savings', 'save', 'poupanca'] },
  { emoji: '📈', keywords: ['inversion', 'inversiones', 'investment', 'investimento', 'acciones', 'stocks', 'bolsa'] },
  { emoji: '💳', keywords: ['deuda', 'deudas', 'debt', 'divida', 'prestamo', 'emprestimo', 'credito', 'credit', 'loan', 'cuota', 'tarjeta'] },
  { emoji: '🛡️', keywords: ['seguro', 'seguros', 'insurance', 'poliza', 'seguranca'] },
  { emoji: '👨‍👩‍👧', keywords: ['familia', 'family', 'hijo', 'hijos', 'kids', 'children', 'ninos', 'filho', 'crianca'] },
  { emoji: '💅', keywords: ['belleza', 'cuidado personal', 'beauty', 'peluqueria', 'salon', 'estetica', 'beleza'] },
  { emoji: '🏋️', keywords: ['gimnasio', 'gym', 'deporte', 'deportes', 'sport', 'sports', 'esporte', 'fitness'] },
  { emoji: '🤝', keywords: ['donacion', 'donaciones', 'caridad', 'donation', 'charity', 'doacao'] },
  { emoji: '🏦', keywords: ['comision', 'comisiones', 'banco', 'bank', 'fee', 'fees', 'tarifa', 'tarifas'] },
  { emoji: '🔁', keywords: ['transferencia', 'transferencias', 'transfer'] },
  { emoji: '🧹', keywords: ['limpieza', 'cleaning', 'limpeza', 'aseo'] },
]

interface ScoredMatch {
  emoji: string
  score: number
  order: number
}

function tokenize(normalized: string): string[] {
  return normalized.split(/[^a-z0-9]+/).filter(Boolean)
}

function keywordScore(tokens: string[], normalized: string, keyword: string): number {
  if (tokens.includes(keyword)) return 3
  if (keyword.length >= 3 && tokens.some((token) => token.startsWith(keyword) || keyword.startsWith(token))) return 2
  // Only fall back to raw substring matching for longer keywords -- short ones (e.g. "cat", "gas")
  // false-positive far too easily inside unrelated words (e.g. "cat" inside "education").
  if (keyword.length >= 5 && normalized.includes(keyword)) return 1
  return 0
}

// Matches combining diacritical marks (U+0300-U+036F) left behind by name.normalize('NFD').
const DIACRITICS_PATTERN = new RegExp(String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d), 'g')

export function suggestedCategoryIcons(name: string, type: TransactionType): string[] {
  const normalized = name.normalize('NFD').replace(DIACRITICS_PATTERN, '').toLowerCase().trim()
  const defaults = type === 'income' ? ['💰', '💼', '📈', '🎁', '🏦', '🧑‍💻'] : ['🛒', '🍽️', '🚕', '🏠', '🧾', '💳']

  if (!normalized) return defaults.slice(0, 6)

  const tokens = tokenize(normalized)
  const matches: ScoredMatch[] = []

  rules.forEach((rule, order) => {
    const score = Math.max(0, ...rule.keywords.map((keyword) => keywordScore(tokens, normalized, keyword)))
    if (score > 0) matches.push({ emoji: rule.emoji, score, order })
  })

  matches.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.order - b.order))

  const seen = new Set<string>()
  const ranked = matches.map((match) => match.emoji).filter((emoji) => (seen.has(emoji) ? false : (seen.add(emoji), true)))

  if (ranked.length >= 3) return ranked.slice(0, 6)

  const padded = [...ranked, ...defaults.filter((emoji) => !seen.has(emoji))]
  return padded.slice(0, 6)
}
