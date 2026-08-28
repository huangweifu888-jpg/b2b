import ContentLibraryEditor from "@/components/ContentLibraryEditor";
import { FactoryPage } from "@/page-factory/FactoryPage";

export default function Cases() {
  return <FactoryPage pageId="client-cases" template="editor" sourceScope="client_source"><ContentLibraryEditor kind="cases" /></FactoryPage>;
}
