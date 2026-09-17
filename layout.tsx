import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata={title:"AI Video Call",description:"Browser video call MVP"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}