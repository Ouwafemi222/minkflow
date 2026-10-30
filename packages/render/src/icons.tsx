import type { IconId } from '@minkflow/contracts';
import {
  Activity, Atom, Award, Bell, BookOpen, Brain, Briefcase, Building, Calculator, Calendar, Camera, Car, ChartPie,
  Check, Clock, Cloud, Code, Coffee, Cpu, Database, DollarSign, Droplet, Flag, Flame, Gift, Globe, GraduationCap,
  Headphones, Heart, Hourglass, House, Key, Laptop, Leaf, Lightbulb, Link, Lock, Mail, MapPin, Megaphone,
  MessageCircle, Mic, Microscope, Moon, Package, Percent, PiggyBank, Plane, Play, Rocket, Scale, Search, Settings,
  Shield, ShoppingCart, Smartphone, Sparkles, Star, Sun, Target, TrendingDown, TrendingUp, Trophy, Truck, User,
  Users, Wallet, Wrench, X, Zap, type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<IconId, LucideIcon> = {
  lightbulb: Lightbulb, rocket: Rocket, brain: Brain, 'book-open': BookOpen, 'graduation-cap': GraduationCap,
  'dollar-sign': DollarSign, 'piggy-bank': PiggyBank, 'trending-up': TrendingUp, 'trending-down': TrendingDown,
  globe: Globe, clock: Clock, calendar: Calendar, users: Users, user: User, heart: Heart, shield: Shield, lock: Lock,
  zap: Zap, target: Target, flag: Flag, star: Star, check: Check, x: X, search: Search, cpu: Cpu, database: Database,
  cloud: Cloud, smartphone: Smartphone, laptop: Laptop, leaf: Leaf, sun: Sun, moon: Moon, droplet: Droplet,
  flame: Flame, 'map-pin': MapPin, 'message-circle': MessageCircle, mic: Mic, headphones: Headphones, play: Play,
  settings: Settings, wrench: Wrench, briefcase: Briefcase, building: Building, car: Car, plane: Plane,
  coffee: Coffee, gift: Gift, trophy: Trophy, award: Award, key: Key, package: Package,
  'shopping-cart': ShoppingCart, truck: Truck, wallet: Wallet, percent: Percent, calculator: Calculator, atom: Atom,
  microscope: Microscope, sparkles: Sparkles, megaphone: Megaphone, scale: Scale, hourglass: Hourglass,
  house: House, bell: Bell, camera: Camera, code: Code, link: Link, mail: Mail, 'chart-pie': ChartPie,
  activity: Activity,
};

export function Icon({ id, size, color, strokeWidth = 2 }: { id: IconId; size: number; color: string; strokeWidth?: number }) {
  const Component = ICONS[id];
  return <Component size={size} color={color} strokeWidth={strokeWidth} aria-hidden />;
}
