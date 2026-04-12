'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface PageHeroProps {
    title: string;
    subtitle?: string;
    backgroundImage?: string;
    backgroundImages?: string[];
}

export default function PageHero({ title, subtitle, backgroundImage, backgroundImages }: PageHeroProps) {
    const images = backgroundImages?.length ? backgroundImages : (backgroundImage ? [backgroundImage] : []);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (images.length > 1) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % images.length);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [images.length]);

    return (
        <div className={`relative overflow-hidden flex items-center justify-center min-h-[60vh] ${images.length === 0 ? 'bg-blue-900' : ''}`}>
            {images.length > 0 ? (
                <>
                    {images.map((src, index) => (
                        <Image
                            key={src}
                            src={src}
                            alt={`${title} - image ${index + 1}`}
                            fill
                            className={`object-cover transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                            priority={index === 0}
                            sizes="100vw"
                            quality={80}
                        />
                    ))}
                    <div className="absolute inset-0 bg-black/50"></div>
                </>
            ) : (
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                </div>
            )}

            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center z-10 flex flex-col items-center">
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif italic font-medium text-white mb-8 leading-[1.1] drop-shadow-2xl animate-in slide-in-from-bottom-4 duration-700 delay-100">
                    {title}
                </h1>

                {subtitle && (
                    <p className="text-lg md:text-2xl text-blue-50/90 max-w-2xl mx-auto leading-relaxed font-light drop-shadow-lg animate-in slide-in-from-bottom-5 duration-700 delay-200">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}
