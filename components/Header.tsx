import Link from "next/link";
import { Package2, BarChart3, Warehouse } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-xl">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Package2 className="w-5 h-5 text-white" />
            </div>
            <span>allo</span>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">
              fulfillment
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Package2 className="w-4 h-4" />
              Products
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
