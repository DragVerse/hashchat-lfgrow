import * as React from "react";
import Button from "@mui/material/Button";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import { setAccessControlConditions } from "../src/utils";
import LitJsSdk from "lit-js-sdk";
import {
  generateLitAuthSig,
  encryptAndAddMessageToCollection,
  encryptMsg,
  postToInbox,
  encodeb64,
  CHAIN,
} from "../src/utils";
import { TileDocument } from "@ceramicnetwork/stream-tile";
import {
  AppendCollection,
  Collection,
} from "@cbj/ceramic-append-collection/dist/index.js";
import { useSelfID } from "../src/hooks";

export interface SimpleDialogProps {
  open: boolean;
  isCreating: boolean;
  onClose: (value: string) => void;
}

function SimpleDialog(props: SimpleDialogProps) {
  const { onClose, isCreating, open } = props;
  const [selectedValue, setSelectedValue] = React.useState("");

  const handleClose = () => {
    onClose(selectedValue);
  };

  return (
    <Dialog onClose={handleClose} open={open}>
      <DialogTitle>Paste a wallet address below.</DialogTitle>
      <Grid container style={{ padding: "20px" }} alignItems={"center"}>
        <Grid item xs={9}>
          <TextField
            id="outlined-basic"
            label="paste here"
            variant="outlined"
            onChange={(event) => {
              setSelectedValue(event.target.value);
            }}
          />
        </Grid>
        <Grid item xs={3}>
          <Button
            size="small"
            variant="contained"
            onClick={handleClose}
            disabled={isCreating}
          >
            Enter
          </Button>
        </Grid>
      </Grid>
    </Dialog>
  );
}

export default function Overlay() {
  const [open, setOpen] = React.useState(false);
  const [isCreating, setCreating] = React.useState(false);
  const { selfID, web3Provider } = useSelfID();

  const createThread = async (toAddr: string) => {
    setCreating(true);

    const litNodeClient = new LitJsSdk.LitNodeClient();

    await litNodeClient.connect();

    const collection: Collection = (await AppendCollection.create(
      selfID.client.ceramic,
      {
        sliceMaxItems: 256,
      }
    )) as Collection;

    const accessControlConditions = setAccessControlConditions(toAddr);
    const { encryptedString, symmetricKey } = await LitJsSdk.encryptString("");
    // Encrypt collection stream ID using dag-jose
    const encryptedStreamId = await encryptMsg(
      { threadStreamId: collection.id.toString() },
      symmetricKey
    );
    let authSig = await generateLitAuthSig(web3Provider.provider);

    const encryptedSymmetricKey = await litNodeClient.saveEncryptionKey({
      accessControlConditions,
      symmetricKey,
      authSig,
      chain: CHAIN,
    });

    const doc = await TileDocument.create(selfID.client.ceramic, {
      accessControlConditions: accessControlConditions,
      encryptedSymmetricKey: encodeb64(encryptedSymmetricKey),
      encryptedStreamId: encryptedStreamId,
    });
    const _streamId = doc.id.toString();

    await postToInbox(toAddr, _streamId);

    console.log("Collection: ", collection.id.toString());

    setCreating(false);
    setOpen(false);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = (value: string) => {
    createThread(value);
  };

  return (
    <div>
      <br />
      <Button variant="contained" color="secondary" onClick={handleClickOpen}>
        Create Thread
      </Button>
      <SimpleDialog open={open} isCreating={isCreating} onClose={handleClose} />
    </div>
  );
}
