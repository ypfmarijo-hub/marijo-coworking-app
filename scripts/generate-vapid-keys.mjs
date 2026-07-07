import webPush from 'web-push'

const vapidKeys = webPush.generateVAPIDKeys()

console.log('=== VAPID KEYS GENERATED ===')
console.log('')
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY:')
console.log(vapidKeys.publicKey)
console.log('')
console.log('VAPID_PRIVATE_KEY:')
console.log(vapidKeys.privateKey)
console.log('')
console.log('VAPID_EMAIL:')
console.log('mailto:tu-email@marijo.com.ar')
console.log('')
console.log('=== Copy these values to your Vercel environment variables ===')
