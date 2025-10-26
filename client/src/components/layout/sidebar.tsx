import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
	BarChart3, 
	Package, 
	Bot, 
	Tag, 
	Tags,
	AlertTriangle, 
	MapPin, 
	ShoppingCart, 
	FileText,
	LogOut,
	User,
	X,
	Menu,
	Cpu,
	ShoppingBag
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Inventory", href: "/inventory", icon: Package },
  // { name: "Arduino Integration", href: "/arduino", icon: Cpu },
  { name: "AI Predictions", href: "/ai-predictions", icon: Bot },
  { name: "Price Optimization", href: "/pricing", icon: Tag },
  { name: "Categories", href: "/categories", icon: Tags },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Location Insights", href: "/locations", icon: MapPin },
  { name: "Purchase Orders", href: "/orders", icon: ShoppingCart },
  { name: "Sales", href: "/sales", icon: ShoppingBag },
  { name: "Reports", href: "/reports", icon: FileText },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 lg:z-9">
        <div className="flex flex-col flex-grow pt-5 bg-sidebar border-r border-sidebar-border shadow-lg h-full">
          {/* Logo and Brand */}
          <div className="flex items-center flex-shrink-0 px-6 pb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center ring-2 ring-primary/30">
                <Package className="text-primary-foreground w-5 h-5" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-foreground">InvenAI</h1>
                <p className="text-xs text-muted-foreground">Smart Inventory</p>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="mt-2 flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <Link key={item.name} href={item.href}>
                  <div 
                    className={`
                      group flex items-center px-4 py-2.5 text-sm font-medium rounded-lg mx-2 transition-all duration-200 cursor-pointer
                      ${
                        isActive 
                          ? 'bg-primary/20 text-foreground shadow-lg ring-1 ring-primary/30' 
                          : 'text-foreground hover:bg-sidebar-accent hover:text-foreground hover:ring-1 hover:ring-sidebar-ring/30'
                      }
                    `} 
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon 
                      className={`mr-3 w-5 h-5 ${
                        isActive 
                          ? 'text-primary' 
                          : 'text-muted-foreground group-hover:text-foreground'
                      }`} 
                    />
                    <span className="transition-all duration-200">
                      {item.name}
                    </span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-6 bg-primary rounded-full"></span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="flex-shrink-0 p-4 border-t border-sidebar-border mt-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center border border-border">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-foreground" data-testid="text-username">
                    {user?.username || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-user-role">
                    {user?.role || "Manager"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => logoutMutation.mutate()}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
                data-testid="button-logout"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu toggle button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-sidebar border border-sidebar-border rounded-lg p-2.5 shadow-lg hover:bg-sidebar-accent transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed inset-0 z-50 flex transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop with blur */}
        <div 
          className={`fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Sidebar */}
        <div className={`relative flex-1 flex flex-col max-w-xs w-full bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full hover:bg-sidebar-accent transition-colors"
              aria-label="Close menu"
            >
              <X className="h-6 w-6 text-foreground" />
            </button>
          </div>
          
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 px-6 py-4 mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center ring-2 ring-primary/30">
                  <Package className="text-primary-foreground w-5 h-5" />
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-bold text-foreground">InvenAI</h1>
                  <p className="text-xs text-muted-foreground">Smart Inventory</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                
                return (
                  <Link key={item.name} href={item.href}>
                    <div 
                      className={`
                        group flex items-center px-4 py-3 text-sm font-medium rounded-lg mx-2 transition-all duration-200
                        ${
                          isActive 
                            ? 'bg-primary/20 text-foreground shadow-lg ring-1 ring-primary/30' 
                            : 'text-foreground hover:bg-sidebar-accent hover:text-foreground hover:ring-1 hover:ring-sidebar-ring/30'
                        }
                      `}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon 
                        className={`mr-3 w-5 h-5 ${
                          isActive 
                            ? 'text-primary' 
                            : 'text-muted-foreground group-hover:text-foreground'
                        }`} 
                      />
                      <span className="transition-all duration-200">
                        {item.name}
                      </span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-6 bg-primary rounded-full"></span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile - Mobile */}
          <div className="flex-shrink-0 p-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center border border-border">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-foreground">
                    {user?.username || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.role || "Manager"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  logoutMutation.mutate();
                  setIsMobileMenuOpen(false);
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            </div>
          </div>
        </div>
    </>
  );
}
