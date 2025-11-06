/**
 * IncentiveLogForm.tsx
 * Encoder-only form for recording seed distribution events
 * Features: Farmer search, validation, signature requirement, shortage alerts
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertCircle, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    Input,
    Select,
    Textarea,
    Checkbox,
    Button,
    Alert,
    Card,
} from '../ui/UIComponents';
import { farmerApi, incentiveApi } from '../../services/incentiveApi';
import {
    CreateIncentiveRequest,
    FarmerSearchResult,
    INCENTIVE_TYPES,
} from '../../types/incentive';

// ============================================================
// Component
// ============================================================

export const IncentiveLogForm: React.FC = () => {
    // Form state
    const [formData, setFormData] = useState({
        farmer_id: 0,
        farmer_name: '',
        event_date: new Date().toISOString().split('T')[0],
        incentive_type: INCENTIVE_TYPES[0],
        qty_requested: '',
        qty_received: '',
        is_signed: false,
        note: '',
    });

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FarmerSearchResult[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Calculate shortage
    const shortage = formData.qty_requested && formData.qty_received
        ? parseFloat(formData.qty_requested) - parseFloat(formData.qty_received)
        : 0;

    // ============================================================
    // Farmer Search
    // ============================================================

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearchResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchFarmers = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const results = await farmerApi.search(searchQuery);
                setSearchResults(results);
                setShowSearchResults(true);
            } catch (error) {
                console.error('Search error:', error);
                toast.error('Failed to search farmers');
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(searchFarmers, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchQuery]);

    const handleSelectFarmer = (farmer: FarmerSearchResult) => {
        setFormData((prev) => ({
            ...prev,
            farmer_id: farmer.id,
            farmer_name: farmer.name,
        }));
        setSearchQuery(`${farmer.name} (${farmer.rsbsa_num})`);
        setShowSearchResults(false);
        setErrors((prev) => ({ ...prev, farmer_id: '' }));
    };

    const handleClearFarmer = () => {
        setFormData((prev) => ({ ...prev, farmer_id: 0, farmer_name: '' }));
        setSearchQuery('');
    };

    // ============================================================
    // Form Validation
    // ============================================================

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.farmer_id) {
            newErrors.farmer_id = 'Please select a farmer';
        }

        if (!formData.event_date) {
            newErrors.event_date = 'Event date is required';
        } else {
            const eventDate = new Date(formData.event_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (eventDate > today) {
                newErrors.event_date = 'Event date cannot be in the future';
            }
        }

        if (!formData.incentive_type) {
            newErrors.incentive_type = 'Please select an incentive type';
        }

        const qtyRequested = parseFloat(formData.qty_requested);
        if (!formData.qty_requested || isNaN(qtyRequested) || qtyRequested <= 0) {
            newErrors.qty_requested = 'Must be greater than 0';
        }

        const qtyReceived = parseFloat(formData.qty_received);
        if (formData.qty_received === '' || isNaN(qtyReceived) || qtyReceived < 0) {
            newErrors.qty_received = 'Cannot be negative';
        } else if (qtyReceived > qtyRequested) {
            newErrors.qty_received = 'Cannot exceed requested quantity';
        }

        if (!formData.is_signed) {
            newErrors.is_signed = 'Farmer signature is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ============================================================
    // Form Submission
    // ============================================================

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('Please fix the errors in the form');
            return;
        }

        setIsLoading(true);

        try {
            const requestData: CreateIncentiveRequest = {
                farmer_id: formData.farmer_id,
                event_date: formData.event_date,
                incentive_type: formData.incentive_type,
                qty_requested: parseFloat(formData.qty_requested),
                qty_received: parseFloat(formData.qty_received),
                is_signed: formData.is_signed,
                note: formData.note || undefined,
            };

            const response = await incentiveApi.createLog(requestData);

            if (response.success) {
                toast.success(response.message);

                // Reset form
                setFormData({
                    farmer_id: 0,
                    farmer_name: '',
                    event_date: new Date().toISOString().split('T')[0],
                    incentive_type: INCENTIVE_TYPES[0],
                    qty_requested: '',
                    qty_received: '',
                    is_signed: false,
                    note: '',
                });
                setSearchQuery('');
                setErrors({});
            }
        } catch (error: any) {
            console.error('Submit error:', error);

            if (error.errors) {
                // Handle validation errors from backend
                const backendErrors: Record<string, string> = {};
                error.errors.forEach((err: any) => {
                    backendErrors[err.field] = err.message;
                });
                setErrors(backendErrors);
                toast.error('Validation failed');
            } else {
                toast.error(error.message || 'Failed to create log');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================================
    // Render
    // ============================================================

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            <Card title="Record Incentive Distribution" subtitle="Enter details of completed distribution event">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Farmer Search */}
                    <div className="relative" ref={searchRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Search Farmer <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                                placeholder="Search by name or RSBSA number..."
                                className={`w-full pl-10 pr-10 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.farmer_id ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                disabled={formData.farmer_id > 0}
                            />
                            {formData.farmer_id > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearFarmer}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                </button>
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {showSearchResults && searchResults.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                                {searchResults.map((farmer) => (
                                    <button
                                        key={farmer.id}
                                        type="button"
                                        onClick={() => handleSelectFarmer(farmer)}
                                        className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b last:border-b-0"
                                    >
                                        <div className="font-medium text-gray-900">{farmer.name}</div>
                                        <div className="text-sm text-gray-600">
                                            RSBSA: {farmer.rsbsa_num}
                                            {farmer.barangay && ` • ${farmer.barangay}`}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {isSearching && (
                            <div className="absolute right-3 top-9">
                                <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            </div>
                        )}

                        {errors.farmer_id && <p className="mt-1 text-sm text-red-600">{errors.farmer_id}</p>}
                        {searchQuery.length > 0 && searchQuery.length < 2 && (
                            <p className="mt-1 text-sm text-gray-500">Type at least 2 characters to search</p>
                        )}
                    </div>

                    {/* Selected Farmer Display */}
                    {formData.farmer_id > 0 && (
                        <Alert variant="success">
                            <div className="flex items-center">
                                <CheckCircle className="h-5 w-5 mr-2" />
                                <span className="font-medium">Selected: {formData.farmer_name}</span>
                            </div>
                        </Alert>
                    )}

                    {/* Event Date */}
                    <Input
                        type="date"
                        label="Event Date"
                        value={formData.event_date}
                        onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                        error={errors.event_date}
                        max={new Date().toISOString().split('T')[0]}
                        required
                    />

                    {/* Incentive Type */}
                    <Select
                        label="Incentive Type"
                        value={formData.incentive_type}
                        onChange={(e) => setFormData({ ...formData, incentive_type: e.target.value })}
                        options={INCENTIVE_TYPES.map((type) => ({ value: type, label: type }))}
                        error={errors.incentive_type}
                        required
                    />

                    {/* Quantities Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            type="number"
                            label="Quantity Requested"
                            value={formData.qty_requested}
                            onChange={(e) => setFormData({ ...formData, qty_requested: e.target.value })}
                            error={errors.qty_requested}
                            min="0"
                            step="0.01"
                            placeholder="20.00"
                            required
                        />

                        <Input
                            type="number"
                            label="Quantity Received"
                            value={formData.qty_received}
                            onChange={(e) => setFormData({ ...formData, qty_received: e.target.value })}
                            error={errors.qty_received}
                            min="0"
                            step="0.01"
                            placeholder="20.00"
                            required
                        />
                    </div>

                    {/* Shortage Warning */}
                    {shortage > 0 && formData.qty_requested && formData.qty_received && (
                        <Alert variant="warning">
                            <div className="flex items-center">
                                <AlertCircle className="h-5 w-5 mr-2" />
                                <span>
                                    <strong>Shortage detected:</strong> {shortage.toFixed(2)} units short
                                </span>
                            </div>
                        </Alert>
                    )}

                    {/* Signature Checkbox */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <Checkbox
                            label="Farmer has signed the paper receipt"
                            checked={formData.is_signed}
                            onChange={(e) => setFormData({ ...formData, is_signed: e.target.checked })}
                            error={errors.is_signed}
                            required
                        />
                        <p className="mt-2 ml-6 text-sm text-gray-600">
                            ⚠️ This field is required. Distribution cannot be recorded without farmer's signature.
                        </p>
                    </div>

                    {/* Note */}
                    <Textarea
                        label="Notes (Optional)"
                        value={formData.note}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        placeholder="e.g., Shortage due to high demand, issued IOU for remaining amount..."
                        rows={3}
                        maxLength={1000}
                    />

                    {/* Submit Button */}
                    <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setFormData({
                                    farmer_id: 0,
                                    farmer_name: '',
                                    event_date: new Date().toISOString().split('T')[0],
                                    incentive_type: INCENTIVE_TYPES[0],
                                    qty_requested: '',
                                    qty_received: '',
                                    is_signed: false,
                                    note: '',
                                });
                                setSearchQuery('');
                                setErrors({});
                            }}
                        >
                            Reset
                        </Button>
                        <Button type="submit" isLoading={isLoading} disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Record Distribution'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
