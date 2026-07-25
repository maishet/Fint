import type { TransactionType } from '../api/types'

const rules: Array<{ emoji: string; words: string[] }> = [
  { emoji: '🍽️', words: ['aliment', 'comida', 'food', 'restaurante', 'cena', 'almuerzo'] },
  { emoji: '🚕', words: ['transport', 'taxi', 'uber', 'bus', 'movilidad'] },
  { emoji: '🏠', words: ['casa', 'alquiler', 'aluguel', 'hogar', 'home', 'vivienda'] },
  { emoji: '💡', words: ['luz', 'agua', 'servicio', 'service', 'internet', 'telefone', 'telefono'] },
  { emoji: '💊', words: ['salud', 'medicina', 'farmacia', 'doctor'] },
  { emoji: '🎓', words: ['educacion', 'colegio', 'curso', 'universidad'] },
  { emoji: '🎬', words: ['entreten', 'cine', 'streaming', 'juego'] },
  { emoji: '✈️', words: ['viaje', 'vuelo', 'hotel', 'vacacion'] },
  { emoji: '🐶', words: ['mascota', 'perro', 'gato', 'veterinaria'] },
  { emoji: '🛒', words: ['super', 'mercado', 'compra'] },
  { emoji: '💳', words: ['debt', 'payment', 'divida', 'deuda', 'emprestimo', 'prestamo', 'credito', 'pago'] },
  { emoji: '👕', words: ['ropa', 'vestido', 'calzado'] },
  { emoji: '🎁', words: ['regalo', 'obsequio'] },
  { emoji: '💻', words: ['tecnologia', 'computadora', 'software'] },
  { emoji: '🧾', words: ['impuesto', 'tributo'] },
  { emoji: '💼', words: ['salary', 'sueldo', 'salario', 'freelance', 'trabalho', 'trabajo'] },
  { emoji: '💰', words: ['ahorro', 'interes', 'inversion', 'ingreso'] },
]

export function suggestedCategoryIcons(name: string, type: TransactionType) {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const matched = rules.filter((rule) => rule.words.some((word) => normalized.includes(word))).map((rule) => rule.emoji)
  const defaults = type === 'income' ? ['💰', '💼', '📈', '🎁'] : ['🛒', '🍽️', '🚕', '🏠']
  return [...new Set([...matched, ...defaults])].slice(0, 4)
}
