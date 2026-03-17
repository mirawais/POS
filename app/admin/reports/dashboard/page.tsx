'use client';

import { AdminHeader } from '@/components/layout/AdminHeader';
import { BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react';

export default function ReportsDashboardPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <AdminHeader title="Analytics Dashboard" />
            <div className="p-6 space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Visual Insights</h1>
                        <p className="text-sm text-gray-500">Real-time charts and revenue forecasting.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                            <span className="text-[10px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-full">+12.5%</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Growth Rate</p>
                            <p className="text-2xl font-black text-gray-900">Healthy</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><PieChart size={20} /></div>
                            <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Weekly</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Market Share</p>
                            <p className="text-2xl font-black text-gray-900">Top 10%</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Activity size={20} /></div>
                            <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full">Live</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Orders</p>
                            <p className="text-2xl font-black text-gray-900">42</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><BarChart3 size={20} /></div>
                            <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-full">-2.1%</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Returns Rate</p>
                            <p className="text-2xl font-black text-gray-900">Low</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-96 flex flex-col items-center justify-center space-y-4">
                        <div className="p-4 bg-gray-50 rounded-full text-gray-300 animate-pulse"><BarChart3 size={48} /></div>
                        <div className="text-center">
                            <p className="font-black text-gray-800 uppercase tracking-widest text-xs">Revenue Chart Placeholder</p>
                            <p className="text-gray-400 text-[10px] font-medium mt-1">Integrating Chart.js / Recharts components...</p>
                        </div>
                    </div>
                    <div className="bg-gray-900 p-8 rounded-3xl shadow-2xl flex flex-col justify-between text-white">
                        <div>
                            <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-4">Premium Insights</p>
                            <h2 className="text-2xl font-black leading-tight">Your business is performing <span className="text-emerald-400">above average</span> this week.</h2>
                            <p className="text-gray-400 text-sm mt-4 font-medium leading-relaxed">Most revenue is coming from <span className="text-white font-bold">Delivery</span>. Consider promoting dine-in offers during the weekend to balance the mode distribution.</p>
                        </div>
                        <div className="mt-8 pt-8 border-t border-gray-800">
                            <button className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors">Upgrade Analytics</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
