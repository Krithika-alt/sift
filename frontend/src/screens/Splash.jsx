import Wordmark from '../components/Wordmark.jsx'

/** Soil with film grain and the eggshell lettering. App calls GET /api/health while it shows. */
export default function Splash() {
  return (
    <div className="soil flex h-full flex-col items-center justify-center px-5 pb-[34px]">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Wordmark size={120} onSoil />
        <p className="mt-4 font-display text-[28px] text-eggshell">We dig. You dig in.</p>
      </div>
      <p className="text-[15px] font-semibold text-eggshell/80">Checking shelves near you</p>
    </div>
  )
}
