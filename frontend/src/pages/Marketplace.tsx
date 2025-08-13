import React from 'react';
import { MarketplaceView } from '../components/marketplace/MarketplaceView';
import { useMarketplace } from '../hooks/useMarketplace';
import { MarketplaceItem } from '../types/marketplace';

const MarketplacePage: React.FC = () => {
  const { installItem, loading, error } = useMarketplace();

  const handleInstall = (item: MarketplaceItem) => {
    installItem(item);
  };

  return (
    <div className="flex-1 overflow-auto">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg m-4">
          {error}
        </div>
      )}
      <MarketplaceView onInstall={handleInstall} />
    </div>
  );
};

export default MarketplacePage;