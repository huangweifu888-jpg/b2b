import ContentLibraryEditor from "@/components/ContentLibraryEditor";
import { FactoryPage } from "@/page-factory/FactoryPage";

export default function NewsCenter() {
  return <FactoryPage pageId="client-news-center" template="editor" sourceScope="client_source"><ContentLibraryEditor kind="news" /></FactoryPage>;
}
