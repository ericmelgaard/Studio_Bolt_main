import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Search, CreditCard as Edit, ArrowRight } from 'lucide-react';

interface Concept {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  brand_primary_color?: string;
  brand_secondary_color?: string;
  company_count?: number;
  store_count?: number;
}

interface ConceptsGridProps {
  concepts: Concept[];
  onEdit: (concept: Concept) => void;
  onSelect: (concept: Concept) => void;
}

export default function ConceptsGrid({ concepts, onEdit, onSelect }: ConceptsGridProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConcepts = concepts.filter(concept =>
    concept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (concept.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderIcon = (iconName?: string) => {
    if (!iconName) return <Icons.Building2 size={24} />;
    const IconComponent = Icons[iconName as keyof typeof Icons] as any;
    return IconComponent ? <IconComponent size={24} /> : <Icons.Building2 size={24} />;
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search brands..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filteredConcepts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Icons.Building2 size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No brands found</p>
          <p className="text-sm mt-1">
            {searchTerm ? 'Try adjusting your search' : 'Click "Add Concept" to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Concept
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Companies
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stores
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredConcepts.map((concept) => (
                  <tr
                    key={concept.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{
                            backgroundColor: concept.brand_primary_color || '#E5E7EB',
                            color: concept.brand_primary_color ? '#FFFFFF' : '#374151'
                          }}
                        >
                          {renderIcon(concept.icon)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{concept.name}</div>
                          {concept.brand_primary_color && (
                            <div className="flex items-center gap-1 mt-1">
                              <div
                                className="w-4 h-4 rounded border border-gray-300"
                                style={{ backgroundColor: concept.brand_primary_color }}
                              />
                              {concept.brand_secondary_color && (
                                <div
                                  className="w-4 h-4 rounded border border-gray-300"
                                  style={{ backgroundColor: concept.brand_secondary_color }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-md truncate">
                        {concept.description || <span className="text-gray-400 italic">No description</span>}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-semibold text-gray-900">
                        {concept.company_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-semibold text-gray-900">
                        {concept.store_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(concept);
                          }}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit concept"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => onSelect(concept)}
                          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          View
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
