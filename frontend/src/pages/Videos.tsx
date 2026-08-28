import ContentLibraryEditor from "@/components/ContentLibraryEditor";
import { FactoryPage } from "@/page-factory/FactoryPage";

export default function Videos() {
  return <FactoryPage pageId="client-videos" template="editor" sourceScope="client_source" autoRegions><ContentLibraryEditor kind="videos" /></FactoryPage>;
}
