import { format } from "date-fns"

export default function GreetingBanner({ user }) {
  return (
    <div className="p-6 rounded-2xl bg-blue-50 overflow-hidden relative">
      <div className="grid grid-cols-12">
        <div className="lg:col-span-7 md:col-span-7 sm:col-span-12 col-span-12">
          
          {/* User */}
          <div className="flex gap-3 items-center">
            <div className="rounded-full bg-gradient-to-br from-blue-400 to-blue-600 w-10 h-10 flex items-center justify-center text-white font-bold">
              {user?.username?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h5 className="text-lg font-semibold">
                Welcome back {user?.username || "User"}!
              </h5>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>

        </div>

        <div className="lg:col-span-5 md:col-span-5 sm:col-span-12 col-span-12">
          <div className="sm:absolute relative right-0 -bottom-8">
            <img
              src="/images/backgrounds/welcome-bg.svg"
              alt="background"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
