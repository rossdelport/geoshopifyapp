import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

// usegeo.app/newhomepage was the preview of the new home page (19 Oct 2026). Since 2 Nov 2026 that design is the
// home page itself, so old links land on "/" (a permanent move; any ?utm_ tags come along).
export const loader = ({ request }: LoaderFunctionArgs) => {
  throw redirect(`/${new URL(request.url).search}`, 301);
};
