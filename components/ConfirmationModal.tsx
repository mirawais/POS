'use client';

import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'danger' | 'primary';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'primary',
}) => {
    if (!isOpen) return null;

    const confirmBtnClass = confirmVariant === 'danger'
        ? "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex-1 sm:flex-none"
        : "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex-1 sm:flex-none";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg transform animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="text-gray-600 leading-relaxed">
                        {message}
                    </div>
                </div>

                <div className="p-6 border-t flex gap-3 justify-end items-center">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors font-medium flex-1 sm:flex-none"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`${confirmBtnClass} font-medium`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
