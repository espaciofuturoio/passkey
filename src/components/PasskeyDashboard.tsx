"use client"

import * as React from "react"
import * as Form from "@radix-ui/react-form"
import { Toaster, toast } from 'sonner'

export function PasskeyDashboard() {
  const [isRegistered, setIsRegistered] = React.useState(false)
  const [isVerified, setIsVerified] = React.useState(false)
  const [action, setAction] = React.useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!action) {
      console.error("Action is undefined")
      return
    }

    toast(`Processing ${action}...`)

    // Simulate passkey registration or verification
    setTimeout(() => {
      toast.dismiss()
      if (action === "register") {
        setIsRegistered(true)
        setIsVerified(false)
        toast("Passkey registered successfully!")
      } else if (action === "verify") {
        setIsVerified(true)
        setIsRegistered(false)
        toast("Passkey verified successfully!")
      }
    }, 1000)
  }

  return (
    <div className="bg-white shadow-lg rounded-lg p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-indigo-800">Passkey Management</h2>
      <Form.Root onSubmit={handleSubmit}>
        <Form.Field name="username">
          <Form.Label className="text-sm font-medium text-gray-700 mb-1 block">Username</Form.Label>
          <Form.Control asChild>
            <input
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm shadow-sm placeholder-black text-black
                         focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200"
              type="text"
              required
              value="test"
              readOnly
            />
          </Form.Control>
          <Form.Message match="valueMissing" className="text-red-500 text-sm mt-1">
            Please enter a username
          </Form.Message>
        </Form.Field>
        <div className="mt-6 flex space-x-4">
          <Form.Submit asChild>
            <button
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200"
              type="submit"
              onClick={() => setAction("register")}
            >
              Register Passkey
            </button>
          </Form.Submit>
          <Form.Submit asChild>
            <button
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors duration-200"
              type="submit"
              onClick={() => setAction("verify")}
            >
              Verify Passkey
            </button>
          </Form.Submit>
        </div>
      </Form.Root>
      {/* {isRegistered && <p className="mt-4 text-green-600 font-medium">Passkey registered successfully!</p>}
      {isVerified && <p className="mt-4 text-green-600 font-medium">Passkey verified successfully!</p>} */}
    </div>
  )
}

