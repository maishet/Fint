import { Fuel, MapPin, ShoppingBag, TreePine, Utensils } from '@tamagui/lucide-icons-2'
import type { PlaceCategory } from '../location/captureLocation'

const CATEGORY_ICONS: Record<PlaceCategory, typeof MapPin> = {
  food: Utensils,
  shopping: ShoppingBag,
  transport: Fuel,
  outdoors: TreePine,
  place: MapPin,
}

export function PlaceCategoryIcon({ category, size = 15 }: { category: PlaceCategory | null; size?: number }) {
  const Icon = category ? CATEGORY_ICONS[category] : MapPin
  return <Icon size={size} color="$color10" />
}
