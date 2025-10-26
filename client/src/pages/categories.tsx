import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Search, Edit, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";
import { Badge } from "@/components/ui/badge";

interface Category {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  productCount?: number;
}

export default function Categories() {
  const [search, setSearch] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories = [], isLoading, error } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch('/api/categories', { 
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      return response.json();
    }
  });

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name, description: "" })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create category');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setNewCategory('');
      toast({
        title: "Success",
        description: "Category created successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive"
      });
    }
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update category');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setEditingId(null);
      setEditValue('');
      toast({
        title: "Success",
        description: "Category updated successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive"
      });
    }
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete category');
      }
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({
        title: "Success",
        description: "Category deleted successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category. Make sure no products are using this category.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategory.trim()) {
      createCategory.mutate(newCategory.trim());
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id || category._id || '');
    setEditValue(category.name);
  };

  const handleUpdate = (id: string) => {
    if (editValue.trim()) {
      updateCategory.mutate({ id, name: editValue.trim() });
    } else {
      toast({
        title: "Error",
        description: "Category name cannot be empty",
        variant: "destructive"
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = (category: Category) => {
    const categoryId = category.id || category._id;
    if (!categoryId) return;

    if (window.confirm(`Are you sure you want to delete the category "${category.name}"? This action cannot be undone.`)) {
      deleteCategory.mutate(categoryId);
    }
  };

  const getCategoryId = (category: Category): string => {
    return category.id || category._id || '';
  };

  const filteredCategories = categories.filter((category: Category) =>
    category.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground mt-1">
              Manage product categories and organization
            </p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="search"
                placeholder="Search categories..."
                className="pl-9 w-full sm:w-[250px]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Add Category Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                placeholder="Enter category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1"
                disabled={createCategory.isPending}
              />
              <Button 
                type="submit" 
                disabled={!newCategory.trim() || createCategory.isPending}
                className="sm:w-auto"
              >
                {createCategory.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> 
                    Add Category
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Categories List Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              All Categories ({categories.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading categories...</p>
              </div>
            ) : error ? (
              <div className="py-8 text-center text-destructive">
                <p>Failed to load categories</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Please try again later'}
                </p>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="py-8 text-center">
                {search ? (
                  <>
                    <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No categories found matching "{search}"</p>
                    <Button 
                      variant="outline" 
                      className="mt-3"
                      onClick={() => setSearch('')}
                    >
                      Clear search
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No categories created yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create your first category to get started
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {filteredCategories.map((category: Category) => {
                  const categoryId = getCategoryId(category);
                  const isEditing = editingId === categoryId;
                  
                  return (
                    <div 
                      key={categoryId}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex gap-2 items-center">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdate(categoryId);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdate(categoryId)}
                            disabled={updateCategory.isPending || !editValue.trim()}
                          >
                            {updateCategory.isPending ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={updateCategory.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{category.name}</span>
                            {category.productCount !== undefined && (
                              <Badge variant="secondary" className="text-xs">
                                {category.productCount} products
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEdit(category)}
                              disabled={deleteCategory.isPending || updateCategory.isPending}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(category)}
                              disabled={deleteCategory.isPending || updateCategory.isPending}
                            >
                              {deleteCategory.isPending ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}