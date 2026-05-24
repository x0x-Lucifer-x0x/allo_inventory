import Link from "next/link";
import { Package2 } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Package2 className="w-16 h-16 text-gray-200 mb-4" />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Not Found</h1>
      <p className="text-gray-500 mb-6">
        The page or resource you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        Back to Products
      </Link>
    </div>
  );
}
