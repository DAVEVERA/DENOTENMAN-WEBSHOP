"use client";

import type { ComponentType } from "react";
import {
  ArrowsClockwise,
  Bag,
  Basket,
  BowlFood,
  Buildings,
  CashRegister,
  CheckCircle,
  CurrencyEur,
  CreditCard,
  Envelope,
  Headset,
  MagnifyingGlass,
  MapPin,
  Package,
  Plus,
  Scales,
  ShoppingBag,
  ShoppingCart,
  ShoppingCartSimple,
  Tag,
  Truck,
  UserCircle,
  X,
} from "@phosphor-icons/react";

type PhosphorProps = { size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false"; "aria-label"?: string };

const iconMap: Record<string, ComponentType<PhosphorProps>> = {
  "shopping-basket": Basket,
  Cart_empty: ShoppingCart,
  search_loop: MagnifyingGlass,
  customer_service: Headset,
  map_pin: MapPin,
  bussines_icon: Buildings,
  medium_bag: Bag,
  portrait: UserCircle,
  checkout: CashRegister,
  Small_bowl: BowlFood,
  bucket: ShoppingBag,
  x: X,
  Submit_cart: ShoppingCartSimple,
  discount: Tag,
  recycle_icon: ArrowsClockwise,
  truck_icon: Truck,
  Mail: Envelope,
  creditcard: CreditCard,
  plus_icon: Plus,
  in_stock: CheckCircle,
  price_tag: CurrencyEur,
  order_unit: Scales,
  product_pack: Package,
};

type IconProps = {
  name: string;
  alt?: string;
  className?: string;
  size?: number;
};

export function Icon({ name, alt = "", className = "", size = 20 }: IconProps) {
  const PhosphorComponent = iconMap[name];

  if (!PhosphorComponent) return null;

  return (
    <PhosphorComponent
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
      className={`ui-icon ${className}`.trim()}
      size={size}
    />
  );
}
