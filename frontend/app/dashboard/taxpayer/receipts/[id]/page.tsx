import ReceiptPage from '@/components/ReceiptPage';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ReceiptPage id={id} portal="individual"/>}
