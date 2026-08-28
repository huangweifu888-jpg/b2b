import ContentLibraryEditor from "@/components/ContentLibraryEditor";
import { FactoryPage } from "@/page-factory/FactoryPage";

export default function BlogOptimize() {
  return <FactoryPage pageId="client-blog-optimize" template="editor" sourceScope="client_source" autoRegions><ContentLibraryEditor kind="blog" /></FactoryPage>;
}
