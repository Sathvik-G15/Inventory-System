import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Package, ShoppingCart, Tags, MapPin, Users, Settings } from 'lucide-react';

type NavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    name: 'Products',
    href: '/products',
    icon: <Package className="h-4 w-4" />,
  },
  {
    name: 'Categories',
    href: '/categories',
    icon: <Tags className="h-4 w-4" />,
  },
  {
    name: 'Locations',
    href: '/locations',
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    name: 'Suppliers',
    href: '/suppliers',
    icon: <Users className="h-4 w-4" />,
  },
  {
    name: 'Sales',
    href: '/sales',
    icon: <ShoppingCart className="h-4 w-4" />,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

export function MainNav() {
  const location = useLocation();

  return (
    <nav className="grid items-start gap-2">
      {navItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className={cn(
            'group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
            location.pathname.startsWith(item.href)
              ? 'bg-accent text-accent-foreground'
              : 'transparent',
          )}
        >
          <span className="mr-3">{item.icon}</span>
          <span>{item.name}</span>
        </Link>
      ))}
    </nav>
  );
}
