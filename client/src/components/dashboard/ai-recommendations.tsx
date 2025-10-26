import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Tag, MapPin, Bot, AlertTriangle, TrendingUp, Package } from "lucide-react";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: "warning" | "success" | "info" | "suggestion";
  confidence: string;
  impact: string;
  priority: "high" | "medium" | "low";
}

interface AiRecommendationsProps {
  recommendations?: Recommendation[];
  isLoading?: boolean;
}

export function AiRecommendations({ recommendations = [], isLoading }: AiRecommendationsProps) {
  // Get icon based on recommendation type
  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return AlertTriangle;
      case "success":
        return TrendingUp;
      case "info":
        return Lightbulb;
      case "suggestion":
        return Package;
      default:
        return Lightbulb;
    }
  };

  // Get styling based on recommendation type
  const getStyles = (type: string) => {
    switch (type) {
      case "warning":
        return {
          bgColor: "bg-orange-50 dark:bg-orange-950/20",
          borderColor: "border-orange-200 dark:border-orange-800",
          iconBgColor: "bg-orange-100 dark:bg-orange-900",
          iconColor: "text-orange-600 dark:text-orange-400",
          badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
        };
      case "success":
        return {
          bgColor: "bg-green-50 dark:bg-green-950/20",
          borderColor: "border-green-200 dark:border-green-800",
          iconBgColor: "bg-green-100 dark:bg-green-900",
          iconColor: "text-green-600 dark:text-green-400",
          badgeColor: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
        };
      case "info":
        return {
          bgColor: "bg-blue-50 dark:bg-blue-950/20",
          borderColor: "border-blue-200 dark:border-blue-800",
          iconBgColor: "bg-blue-100 dark:bg-blue-900",
          iconColor: "text-blue-600 dark:text-blue-400",
          badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
        };
      case "suggestion":
        return {
          bgColor: "bg-purple-50 dark:bg-purple-950/20",
          borderColor: "border-purple-200 dark:border-purple-800",
          iconBgColor: "bg-purple-100 dark:bg-purple-900",
          iconColor: "text-purple-600 dark:text-purple-400",
          badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
        };
      default:
        return {
          bgColor: "bg-gray-50 dark:bg-gray-950/20",
          borderColor: "border-gray-200 dark:border-gray-800",
          iconBgColor: "bg-gray-100 dark:bg-gray-900",
          iconColor: "text-gray-600 dark:text-gray-400",
          badgeColor: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300"
        };
    }
  };

  if (isLoading) {
    return (
      <Card className="lg:col-span-2 bg-card border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center text-foreground">
                <div className="mr-3 p-2 rounded-lg bg-primary/20">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                AI Recommendations
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Smart insights powered by machine learning
              </CardDescription>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <span className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse"></span>
                Loading recommendations...
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="flex items-start p-4 rounded-lg border border-border animate-pulse">
                <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg"></div>
                <div className="ml-3 flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2 bg-card border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center text-foreground">
              <div className="mr-3 p-2 rounded-lg bg-primary/20">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              AI Recommendations
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Smart insights powered by machine learning
            </CardDescription>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              Updated {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recommendations && recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map((recommendation) => {
              const Icon = getIcon(recommendation.type);
              const styles = getStyles(recommendation.type);
              
              return (
                <div 
                  key={recommendation.id} 
                  className={`flex items-start p-4 rounded-lg border ${styles.bgColor} ${styles.borderColor} hover:border-opacity-70 transition-colors`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 ${styles.iconBgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`${styles.iconColor} w-5 h-5`} />
                  </div>
                  <div className="ml-3 flex-1">
                    <h4 className="text-sm font-medium text-foreground">
                      {recommendation.title}
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {recommendation.description}
                    </p>
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                      <Badge 
                        variant="outline" 
                        className={`${styles.badgeColor} border-transparent text-xs font-medium`}
                      >
                        {recommendation.confidence}
                      </Badge>
                      <span className="text-muted-foreground">
                        {recommendation.impact}
                      </span>
                      {recommendation.priority === "high" && (
                        <Badge variant="destructive" className="text-xs">
                          High Priority
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="text-foreground font-medium">No recommendations available</h4>
            <p className="text-muted-foreground text-sm mt-1">
              AI insights will appear here based on your inventory data
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}