
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 128,
                    background: 'black',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                }}
            >
                {/* Your Hexagon Logo SVG */}
                <svg width="256" height="256" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="#f2d363" strokeWidth="2" fill="none" />
                    <path d="M14 6L22 10V18L14 22L6 18V10L14 6Z" fill="#d4a831" opacity="0.3" />
                    <path d="M10 14L13 17L19 11" stroke="#f2d363" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}
