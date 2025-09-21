import React, { useState, useEffect } from 'react';
import { X, Check, Star } from 'lucide-react';

interface CreditPackage {
  id: number;
  credits: number;
  price: number;
  originalPrice: number;
  discount: number;
  popular: boolean;
  description: string;
}

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (credits: number, amount: number) => void;
  currentCredits: number;
  packages?: CreditPackage[];
  userPhone?: string;
}

const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchase,
  currentCredits,
  packages = [],
  userPhone = '+1234567890'
}) => {
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Razorpay configuration
  const RAZORPAY_KEY_ID = 'rzp_test_spaFlmRBxt3gFk';
  const GST_RATE = 18; // 18% GST

      // Default packages if none provided
      const defaultPackages: CreditPackage[] = [
        {
          id: 1,
          credits: 7,
          price: 63,
          originalPrice: 70,
          discount: 10,
          popular: false,
          description: 'Perfect for trying out the app'
        },
        {
          id: 2,
          credits: 77,
          price: 462,
          originalPrice: 660,
          discount: 30,
          popular: true,
          description: 'Most popular choice'
        },
        {
          id: 3,
          credits: 777,
          price: 2331,
          originalPrice: 4662,
          discount: 50,
          popular: false,
          description: 'Great value for regular users'
        },
        {
          id: 4,
          credits: 7777,
          price: 7777,
          originalPrice: 77770,
          discount: 90,
          popular: false,
          description: 'Best value for music lovers'
        }
      ];

  const creditPackages = packages.length > 0 ? packages : defaultPackages;

  // Load Razorpay script
  useEffect(() => {
    const loadRazorpay = () => {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          setRazorpayLoaded(true);
          resolve(true);
        };
        script.onerror = () => {
          console.error('Failed to load Razorpay script');
          resolve(false);
        };
        document.body.appendChild(script);
      });
    };

    if (isOpen && !razorpayLoaded) {
      loadRazorpay();
    }
  }, [isOpen, razorpayLoaded]);

  const calculateGST = (amount: number) => {
    return Math.round((amount * GST_RATE) / 100);
  };

  const calculateTotal = (amount: number) => {
    return amount + calculateGST(amount);
  };

  const handleRazorpayPayment = async (packageData: CreditPackage) => {
    if (!razorpayLoaded) {
      alert('Payment system is loading. Please try again in a moment.');
      return;
    }

    const gstAmount = calculateGST(packageData.price);
    const totalAmount = calculateTotal(packageData.price);

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: totalAmount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      name: 'Raga-Mitra',
      description: `${packageData.credits} Credits Purchase`,
      image: '/logo.png', // You can add your logo here
      order_id: '', // This should be generated from your backend
      handler: async function (response: any) {
        try {
          console.log('Payment successful:', response);
          
          // Create transaction record
          const transactionData = {
            phone: userPhone,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            amount: packageData.price,
            credits: packageData.credits,
            packageId: packageData.id,
            gstAmount: calculatedGST,
            totalAmount: finalTotal
          };

          // Call backend to create transaction
          const transactionResponse = await fetch('http://localhost:3001/api/transactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(transactionData)
          });

          if (transactionResponse.ok) {
            // Payment successful, update credits
            onPurchase(packageData.credits, packageData.price);
            alert(`Payment Successful! Transaction ID: ${response.razorpay_payment_id}`);
            onClose();
          } else {
            throw new Error('Failed to record transaction');
          }
        } catch (error) {
          console.error('Transaction recording failed:', error);
          alert('Payment successful but failed to record transaction. Please contact support.');
        } finally {
          setIsProcessing(false);
        }
      },
      prefill: {
        name: 'User',
        email: 'user@example.com',
        contact: userPhone
      },
      notes: {
        credits: packageData.credits.toString(),
        package_id: packageData.id.toString()
      },
      theme: {
        color: '#8b5cf6'
      },
      modal: {
        ondismiss: function() {
          setIsProcessing(false);
        }
      }
    };

    try {
      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Razorpay error:', error);
      alert('Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    const packageData = creditPackages.find(pkg => pkg.id === selectedPackage);
    if (!packageData) return;

    setIsProcessing(true);
    
    try {
      await handleRazorpayPayment(packageData);
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Purchase failed. Please try again.');
      setIsProcessing(false);
    }
  };

  console.log('CreditPurchaseModal render:', { isOpen, currentCredits });

  if (!isOpen) return null;

  const selectedPackageData = creditPackages.find(pkg => pkg.id === selectedPackage);
  const gstAmount = selectedPackageData ? calculateGST(selectedPackageData.price) : 0;
  const totalAmount = selectedPackageData ? calculateTotal(selectedPackageData.price) : 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div>
            <h2 className="text-2xl font-bold text-white">Buy Credits</h2>
            <p className="text-white/60 mt-1">
              Current balance: <span className="text-primary-400 font-semibold">{currentCredits} credits</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Credit Packages */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Choose a Package</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {creditPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    selectedPackage === pkg.id
                      ? 'border-primary-500 bg-primary-500/20'
                      : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center">
                        <Star className="w-3 h-3 mr-1" />
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">
                      {pkg.credits}
                    </div>
                    <div className="text-sm text-white/60 mb-1">credits</div>
                    
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <span className="text-2xl font-bold text-primary-400">
                        ₹{pkg.price}
                      </span>
                      <span className="text-lg text-white/40 line-through">
                        ₹{pkg.originalPrice}
                      </span>
                      <span className="text-sm text-green-400 font-semibold">
                        {pkg.discount}% OFF
                      </span>
                    </div>
                    
                    <div className="text-xs text-white/60">
                      {pkg.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Summary */}
          {selectedPackageData && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/20">
              <h4 className="text-white font-semibold mb-3">Purchase Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-white/80">
                  <span>Credits:</span>
                  <span>{selectedPackageData.credits}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Amount:</span>
                  <span>₹{selectedPackageData.price}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>GST ({GST_RATE}%):</span>
                  <span>₹{gstAmount}</span>
                </div>
                <div className="border-t border-white/20 pt-2 mt-2">
                  <div className="flex justify-between text-white font-semibold text-lg">
                    <span>Total:</span>
                    <span>₹{totalAmount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={!selectedPackage || isProcessing || !razorpayLoaded}
              className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : !razorpayLoaded ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Loading Payment...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Pay with Razorpay</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditPurchaseModal;