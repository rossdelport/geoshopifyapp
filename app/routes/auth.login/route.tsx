import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { savePlanIntentFromLogin } from "../../lib/plan-intent.server";
import { parsePlanChoice } from "../../lib/plans";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));
  // A plan picked on the website's pricing cards (/auth/login?plan=pro&cycle=yearly) rides along in the form.
  const url = new URL(request.url);
  const choice = parsePlanChoice(url.searchParams.get("plan"), url.searchParams.get("cycle"));

  return { errors, choice };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Save the picked plan by shop domain before Shopify takes over (login() redirects on success).
  if (request.method === "POST") await savePlanIntentFromLogin(await request.clone().formData(), new URL(request.url));
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <>
      <script src="https://cdn.shopify.com/shopifycloud/polaris.js" />
      <s-page>
        <Form method="post">
        {loaderData.choice && (
          <>
            <input type="hidden" name="plan" value={loaderData.choice.plan} />
            <input type="hidden" name="cycle" value={loaderData.choice.cycle} />
          </>
        )}
        <s-section heading="Log in">
          <s-text-field
            name="shop"
            label="Shop domain"
            details="example.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.currentTarget.value)}
            autocomplete="on"
            error={errors.shop}
          ></s-text-field>
          <s-button type="submit">Log in</s-button>
        </s-section>
        </Form>
      </s-page>
    </>
  );
}
