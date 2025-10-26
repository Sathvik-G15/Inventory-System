import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Download, AlertCircle, Clock, Info, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function QuickActions() {
  const [isGeneratingAlerts, setIsGeneratingAlerts] = useState(false);
  const { toast } = useToast();

  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const generateAlertsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/alerts/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alerts generated",
        description: "System alerts have been updated with current data.",
      });
    }
  });

  const handleAddProduct = () => {
    // This would typically open a product form modal
    toast({
      title: "Add Product",
      description: "Navigate to Inventory page to add new products.",
    });
  };

  const handleBulkUpload = () => {
    document.getElementById('bulk-upload-input')?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast({
        title: "File upload started",
        description: `Processing ${file.name}...`,
      });
    }
  };

  const handleExportData = () => {
    toast({
      title: "Export started", 
      description: "Your report will be downloaded shortly.",
    });
  };

  const recentAlerts = (alerts as any[]).slice(0, 3);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <AlertCircle className="text-red-500 dark:text-red-400 w-4 h-4" />;
      case 'expiry':
        return <Clock className="text-amber-500 dark:text-amber-400 w-4 h-4" />;
      default:
        return <Info className="text-blue-500 dark:text-blue-400 w-4 h-4" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 dark:bg-red-500/20 border-red-500/20 dark:border-red-500/30';
      case 'high':
        return 'bg-red-500/10 dark:bg-red-500/20 border-red-500/20 dark:border-red-500/30';
      case 'medium':
        return 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 dark:border-amber-500/30';
      default:
        return 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20 dark:border-blue-500/30';
    }
  };
  
  const getAlertTextColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Quick Actions</CardTitle>
          <CardDescription className="text-muted-foreground">Common inventory management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              onClick={handleAddProduct}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
              data-testid="button-quick-add-product"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Product
            </Button>
            
            <Button
              variant="outline"
              className="w-full bg-muted border-border text-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
              onClick={handleBulkUpload}
              data-testid="button-bulk-upload"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
            
            <input
              id="bulk-upload-input"
              type="file"
              className="hidden"
              accept=".csv,.xlsx"
              onChange={handleFileUpload}
            />
            
            <Button
              variant="outline"
              className="w-full bg-muted border-border text-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
              onClick={handleExportData}
              data-testid="button-export-data"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-foreground">Recent Alerts</CardTitle>
              <CardDescription className="text-muted-foreground">Latest system notifications</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGeneratingAlerts(!isGeneratingAlerts)}
              disabled={generateAlertsMutation.isPending}
              className="text-primary hover:bg-primary/20 hover:text-primary border-primary/30 transition-colors"
              data-testid="button-refresh-alerts"
            >
              {generateAlertsMutation.isPending ? 'Generating...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentAlerts.length > 0 ? (
            <div className="space-y-3">
              {recentAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`flex items-start p-3 rounded-lg border ${getAlertColor(alert.severity)}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className={`text-sm font-medium ${getAlertTextColor(alert.severity)}`}>
                      {alert.title}
                    </p>
                    <p className="text-sm text-foreground mt-0.5">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <Eye className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">No recent alerts</p>
              <p className="text-muted-foreground text-xs mt-1">
                {isGeneratingAlerts ? 'Generating alerts...' : 'System is running smoothly'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
