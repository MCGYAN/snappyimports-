import { MapPin, Truck } from 'lucide-react';

interface CheckoutStepsProps {
  currentStep: number;
}

export default function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const steps = [
    { number: 1, title: 'Shipping', icon: MapPin },
    { number: 2, title: 'Delivery & Payment', icon: Truck }
  ];

  return (
    <div className="flex items-center justify-between max-w-lg mx-auto">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 flex items-center justify-center rounded-full font-bold transition-colors ${
                currentStep >= step.number
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                <Icon className="w-5 h-5" strokeWidth={currentStep >= step.number ? 2.5 : 2} />
              </div>
              <p className={`mt-3 text-sm font-bold ${
                currentStep >= step.number ? 'text-brand-primary' : 'text-gray-400'
              }`}>
                {step.title}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-1 flex-1 mx-2 rounded-full transition-colors ${
                currentStep > step.number ? 'bg-brand-primary' : 'bg-gray-100'
              }`}></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
