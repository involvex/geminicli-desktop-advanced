import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Star, Tag, ExternalLink } from 'lucide-react';
import { MarketplaceItem, MarketplaceFilter } from '../../types/marketplace';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface MarketplaceViewProps {
  onInstall: (item: MarketplaceItem) => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({ onInstall }) => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [filter, setFilter] = useState<MarketplaceFilter>({});

  const loadMarketplaceItems = useCallback(async () => {
    try {
      const mockItems: MarketplaceItem[] = [
        {
          id: 'aws-toolkit',
          name: 'AWS Toolkit',
          description: 'Comprehensive AWS development tools and services integration',
          version: '1.0.0',
          author: 'AWS',
          category: 'extension',
          tags: ['aws', 'cloud', 'development'],
          downloads: 15420,
          rating: 4.8,
          createdAt: '2024-01-15',
          updatedAt: '2024-12-01',
          icon: '🔧',
          repository: 'https://github.com/aws/aws-toolkit-vscode',
          license: 'Apache-2.0'
        },
        {
          id: 'dark-theme-pro',
          name: 'Dark Theme Pro',
          description: 'Professional dark theme with syntax highlighting',
          version: '2.1.0',
          author: 'ThemeStudio',
          category: 'theme',
          tags: ['dark', 'professional', 'syntax'],
          downloads: 8932,
          rating: 4.6,
          createdAt: '2024-02-20',
          updatedAt: '2024-11-15',
          icon: '🎨',
          license: 'MIT'
        }
      ];
      
      setItems(mockItems.filter(item => {
        if (filter.category && item.category !== filter.category) return false;
        if (filter.search && !item.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
        return true;
      }));
    } catch (error) {
      console.error('Failed to load marketplace items:', error);
    }
  }, [filter]);

  useEffect(() => {
    loadMarketplaceItems();
  }, [loadMarketplaceItems]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <Button variant="outline" size="sm">
          <ExternalLink className="w-4 h-4 mr-2" />
          Submit Item
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search extensions, themes, commands..."
            className="pl-10"
            value={filter.search || ''}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
        </div>
        
        <Select value={filter.category || 'all'} onValueChange={(value) => 
          setFilter({ ...filter, category: value === 'all' ? undefined : value as 'extension' | 'command' | 'theme' })
        }>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="extension">Extensions</SelectItem>
            <SelectItem value="command">Commands</SelectItem>
            <SelectItem value="theme">Themes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <Card key={item.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription>by {item.author}</CardDescription>
                  </div>
                </div>
                <Badge variant="default">{item.category}</Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{item.description}</p>
              
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    {item.downloads.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {item.rating}
                  </span>
                </div>
                <span>v{item.version}</span>
              </div>
              
              <Button 
                className="w-full" 
                onClick={() => onInstall(item)}
              >
                <Download className="w-4 h-4 mr-2" />
                Install
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};