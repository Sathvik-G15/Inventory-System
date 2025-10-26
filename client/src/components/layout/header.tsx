import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  Globe,
  Shield,
  Heart,
  CreditCard,
  HelpCircle,
  X,
  Check,
  AlertTriangle,
  Package,
  Calendar,
  TrendingUp,
  MapPin
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  productId?: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

interface SearchResult {
  _id: string;
  type: 'product' | 'category' | 'location';
  name: string;
  description?: string;
  sku?: string;
  stockLevel?: number;
}

interface User {
  username: string;
  email: string;
  role: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
}

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = 'Dashboard', subtitle = '' }: HeaderProps) {
  const { user: authUser, logoutMutation } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  // Fetch notifications first to avoid reference errors
  const { data: notifications = [], refetch: refetchNotifications } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchNotifications();
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
      });
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchNotifications();
    },
  });

  // Fetch user profile data when profile modal is open
  const { data: user, isLoading: isLoadingUser } = useQuery<User>({
    queryKey: ['/api/user'],
    queryFn: async (): Promise<User> => {
      const response = await fetch('/api/user');
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      return response.json();
    },
    enabled: showProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false
  });

  // Default user object to prevent null/undefined errors
  const safeUser = user || {
    username: '',
    email: '',
    role: 'user',
    isActive: false,
    createdAt: new Date().toISOString()
  };

  // Search query
  const { data: searchData = [] } = useQuery<SearchResult[]>({
    queryKey: ['/api/search', searchQuery],
    enabled: searchQuery.length > 2,
  });


  // Mark all notifications as read (using the existing markAllAsReadMutation)
  const markAllAsRead = markAllAsReadMutation;

  // Update profile
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/user/profile", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    }
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return Package;
      case 'expiry': return Calendar;
      case 'price_change': return TrendingUp;
      case 'arduino_alert': return AlertTriangle;
      case 'system': return Settings;
      default: return Bell;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  useEffect(() => {
    if (searchQuery.length > 2) {
      const delayedSearch = setTimeout(() => {
        setSearchResults(searchData);
      }, 300);
      
      return () => clearTimeout(delayedSearch);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchData]);

  const handleProfileUpdate = (data: any) => {
    updateProfileMutation.mutate(data, {
      onSuccess: () => {
        setShowProfile(false);
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
      }
    });
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-30 lg:left-64">
        <div className="flex items-center justify-between h-full px-4 sm:px-6">
          <div className="flex-1 flex items-center">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products, categories..."
                className="w-full pl-9 bg-background/95 backdrop-blur-sm border border-input hover:border-blue-400/50 focus:border-blue-500 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearch(true)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5 text-yellow-400" />
              )}
            </button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="relative p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-0.5 -right-0.5 h-5 w-5 text-xs p-0 flex items-center justify-center bg-red-500 border-2 border-background">
                      {unreadCount}
                    </Badge>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between p-3">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => markAllAsReadMutation.mutate()}
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notification) => {
                      const Icon = getNotificationIcon(notification.type);
                      return (
                        <div
                          key={notification._id}
                          className={`p-3 border-b border-border cursor-pointer hover:bg-muted ${
                            !notification.isRead ? 'bg-muted' : ''
                          }`}
                          onClick={() => {
                            if (!notification.isRead) {
                              markAsReadMutation.mutate(notification._id);
                            }
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <Icon className={`w-4 h-4 mt-1 ${
                              notification.severity === 'critical' ? 'text-red-500' : 
                              notification.severity === 'high' ? 'text-orange-500' : 
                              'text-blue-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {notification.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(notification.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center space-x-2 p-1 pr-2 rounded-full hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  aria-label="User menu"
                >
                  <Avatar className="h-8 w-8 border-2 border-foreground/10 hover:border-blue-500/50 transition-colors">
                    <AvatarImage src={(user as any)?.avatar} />
                    <AvatarFallback className="bg-primary/10 text-foreground">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      {(user as any)?.firstName || user?.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.role || 'Manager'}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowProfile(true)}>
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help & Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => logoutMutation.mutate()}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search Inventory</DialogTitle>
            <DialogDescription>
              Search for products, categories, locations, and more
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Type to search..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {searchResults.map((result) => (
                  <div
                    key={result._id}
                    className="p-3 border border-border rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => setShowSearch(false)}
                  >
                    <div className="flex items-center space-x-3">
                      {result.type === 'product' && <Package className="w-5 h-5 text-blue-500" />}
                      {result.type === 'category' && <Globe className="w-5 h-5 text-green-500" />}
                      {result.type === 'location' && <MapPin className="w-5 h-5 text-purple-500" />}
                      
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{result.name}</p>
                        {result.sku && (
                          <p className="text-sm text-muted-foreground">SKU: {result.sku}</p>
                        )}
                        {result.description && (
                          <p className="text-sm text-muted-foreground">{result.description}</p>
                        )}
                        {result.stockLevel !== undefined && (
                          <Badge variant={result.stockLevel < 10 ? "destructive" : "secondary"}>
                            Stock: {result.stockLevel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length > 2 && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No results found</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription>
              Manage your account settings and preferences
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingUser ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <div className="md:col-span-2">
                          <div className="flex items-center space-x-4">
                            <Avatar className="h-20 w-20">
                              <AvatarImage src={user?.avatar} />
                              <AvatarFallback className="text-2xl">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Button variant="outline" disabled>
                                Change Avatar
                              </Button>
                              <p className="text-sm text-muted-foreground mt-2">
                                Avatar changes are not available in this version
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label>Username</Label>
                          <div className="flex items-center p-2 rounded-md bg-muted/50 text-sm h-10">
                            <span className="text-foreground">{user?.username || 'Not set'}</span>
                          </div>
                        </div>

                        <div>
                          <Label>Email Address</Label>
                          <div className="flex items-center p-2 rounded-md bg-muted/50 text-sm h-10">
                            <span className="text-foreground">{user?.email || 'No email set'}</span>
                          </div>
                        </div>

                        <div>
                          <Label>Role</Label>
                          <div className="flex items-center p-2 rounded-md bg-muted/50 text-sm h-10 capitalize">
                            <span className="text-foreground">{user?.role || 'user'}</span>
                          </div>
                        </div>

                        <div>
                          <Label>Account Status</Label>
                          <div className="flex items-center p-2 rounded-md bg-muted/50 text-sm h-10">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user?.isActive === false 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {user?.isActive === false ? 'Inactive' : 'Active'}
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <Label>Account Created</Label>
                          <div className="flex items-center p-2 rounded-md bg-muted/50 text-sm h-10">
                            <span className="text-foreground">
                              {user?.createdAt 
                                ? new Date(user.createdAt).toLocaleString() 
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-4">
                        <p className="text-sm text-muted-foreground">
                          Note: To update your email or other account details, please contact your administrator.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>
                    Customize your interface theme and display preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="theme">Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Switch between light and dark themes
                      </p>
                    </div>
                    <Switch
                      id="theme"
                      checked={theme === 'dark'}
                      onCheckedChange={toggleTheme}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="language">Language</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred language
                      </p>
                    </div>
                    <select className="border border-border rounded-md px-3 py-2 bg-background text-foreground">
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Control what notifications you receive and how
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Low Stock Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when products are running low
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Expiry Warnings</Label>
                      <p className="text-sm text-muted-foreground">
                        Alerts for products approaching expiry
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Arduino Sensor Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications from connected Arduino sensors
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Price Change Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications for price optimization suggestions
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your account security and password
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input 
                      id="currentPassword" 
                      type="password" 
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input 
                      id="newPassword" 
                      type="password" 
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input 
                      id="confirmPassword" 
                      type="password" 
                      placeholder="Confirm new password"
                    />
                  </div>

                  <Button>Update Password</Button>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <Button variant="outline">Enable 2FA</Button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <p className="text-sm font-medium text-foreground mb-2">Last Login</p>
                    <p className="text-sm text-muted-foreground">
                      {(user as any)?.lastLogin ? new Date((user as any).lastLogin).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Mobile Notifications Modal */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Notifications</DialogTitle>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    markAllAsReadMutation.mutate();
                    setShowNotifications(false);
                  }}
                >
                  Mark all read
                </Button>
              )}
            </div>
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                return (
                  <div
                    key={notification._id}
                    className={`p-3 border border-border rounded-lg ${
                      !notification.isRead ? 'bg-muted border-border' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon className={`w-5 h-5 mt-1 ${
                        notification.severity === 'critical' ? 'text-red-500' : 
                        notification.severity === 'high' ? 'text-orange-500' : 
                        'text-blue-500'
                      }`} />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </p>
                        {!notification.isRead && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 h-6 px-2 text-xs"
                            onClick={() => markAsReadMutation.mutate(notification._id)}
                          >
                            Mark as read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}